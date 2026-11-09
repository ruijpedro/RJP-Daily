package pt.rjp.daily;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class WidgetRenderer {
    private static final TimeZone LISBON = TimeZone.getTimeZone("Europe/Lisbon");
    private static final Locale PT = new Locale("pt", "PT");
    private WidgetRenderer() {}

    private static String format(long time, String pattern) {
        SimpleDateFormat f = new SimpleDateFormat(pattern, PT);
        f.setTimeZone(LISBON);
        return f.format(new Date(time));
    }

    static void redrawAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        redraw(context, manager, manager.getAppWidgetIds(
            new ComponentName(context, AgendaCompactWidget.class)), false);
        redraw(context, manager, manager.getAppWidgetIds(
            new ComponentName(context, AgendaFullWidget.class)), true);
    }

    static void redraw(Context context, AppWidgetManager manager, int[] ids, boolean full) {
        for (int id : ids) {
            try {
                manager.updateAppWidget(id, render(context, full));
            } catch (Exception ignored) {
                // Não bloquear as restantes instâncias no launcher.
            }
        }
    }

    private static RemoteViews render(Context context, boolean full) {
        RemoteViews view = new RemoteViews(context.getPackageName(),
            full ? R.layout.widget_agenda_full : R.layout.widget_agenda_compact);
        Intent open = new Intent(context, MainActivity.class);
        open.setAction(Intent.ACTION_MAIN);
        open.addCategory(Intent.CATEGORY_LAUNCHER);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent click = PendingIntent.getActivity(context, 4504, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        view.setOnClickPendingIntent(R.id.widget_root, click);
        if (full) view.setOnClickPendingIntent(R.id.widget_open, click);

        long now = System.currentTimeMillis();
        String today = format(now, "yyyy-MM-dd");
        long updatedAt = context.getSharedPreferences("agenda_rjp_widget", Context.MODE_PRIVATE)
            .getLong("updatedAt", 0L);
        String raw = context.getSharedPreferences("agenda_rjp_widget", Context.MODE_PRIVATE)
            .getString("events", "[]");

        ArrayList<JSONObject> entries = new ArrayList<>();
        int todayCount = 0;
        try {
            JSONArray stored = new JSONArray(raw);
            for (int i = 0; i < stored.length() && i < 60; i++) {
                JSONObject e = stored.optJSONObject(i);
                if (e == null) continue;
                long at = e.optLong("timestamp", 0L);
                String day = e.optString("date", "");
                if (at <= 0 || day.isEmpty()) continue;
                if (today.equals(day)) todayCount++;
                if (day.compareTo(today) >= 0) entries.add(e);
            }
        } catch (Exception ignored) {
            // Uma atualização parcial não deve provocar crash no launcher.
        }
        Collections.sort(entries, Comparator.comparingLong(e -> e.optLong("timestamp", 0L)));
        view.setTextViewText(R.id.widget_subtitle,
            format(now, "EEE, d MMM") + "  ·  " + todayCount +
            (todayCount == 1 ? " compromisso hoje" : " compromissos hoje"));

        if (!full) {
            if (entries.isEmpty()) {
                view.setTextViewText(R.id.widget_next, updatedAt == 0L ?
                    "Abre a Agenda RJP para carregar os eventos" : "Sem compromissos próximos");
                view.setTextViewText(R.id.widget_meta, "Toca para abrir a agenda");
            } else {
                JSONObject next = entries.get(0);
                view.setTextViewText(R.id.widget_next, next.optString("title", "Compromisso"));
                view.setTextViewText(R.id.widget_meta, itemMeta(next));
            }
        } else {
            int[] rowIds = {R.id.widget_row_1,R.id.widget_row_2,R.id.widget_row_3,R.id.widget_row_4};
            for (int i = 0; i < rowIds.length; i++) {
                if (i < entries.size()) {
                    JSONObject e = entries.get(i);
                    view.setTextViewText(rowIds[i], itemMeta(e) + "   " + e.optString("title", "Compromisso"));
                } else if (i == 0) {
                    view.setTextViewText(rowIds[i], updatedAt == 0L ?
                        "Abre a app para carregar a agenda." : "Sem compromissos para os próximos dias.");
                } else {
                    view.setTextViewText(rowIds[i], "");
                }
            }
            view.setTextViewText(R.id.widget_updated, updatedAt == 0L ?
                "Por sincronizar · abre a app" :
                "Sincronizado: " + format(updatedAt, "d MMM HH:mm") +
                " · toca para abrir a agenda");
        }
        return view;
    }

    private static String itemMeta(JSONObject event) {
        String when = event.optBoolean("allDay", false) ?
            event.optString("date", "") : event.optString("date", "") + " " + event.optString("time", "");
        if (event.optBoolean("allDay", false)) when += " · dia inteiro";
        String source = event.optString("source", "");
        return when + (source.isEmpty() ? "" : " · " + source);
    }
}
