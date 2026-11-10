package pt.rjp.daily;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
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
        PendingIntent click = widgetIntent(context, "agenda", 4504);
        view.setOnClickPendingIntent(R.id.widget_root, click);
        view.setOnClickPendingIntent(R.id.widget_ip_alerts, widgetIntent(context, "alerts", 4507));
        if (full) {
            view.setOnClickPendingIntent(R.id.widget_open, click);
            view.setOnClickPendingIntent(R.id.widget_add, widgetIntent(context, "new", 4505));
            view.setOnClickPendingIntent(R.id.widget_voice, widgetIntent(context, "voice", 4506));
        }

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
                if (day.compareTo(today) > 0 || (today.equals(day) &&
                    (e.optBoolean("allDay", false) || at >= now))) entries.add(e);
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
                view.setTextViewText(R.id.widget_meta, itemMeta(next, now, true));
                view.setTextColor(R.id.widget_meta, itemColor(next));
            }
        } else {
            int[] rowIds = {R.id.widget_row_1,R.id.widget_row_2,R.id.widget_row_3,R.id.widget_row_4};
            for (int i = 0; i < rowIds.length; i++) {
                if (i < entries.size()) {
                    JSONObject e = entries.get(i);
                    view.setTextViewText(rowIds[i], itemMeta(e, now, false) + "  ·  " + e.optString("title", "Compromisso"));
                    view.setTextColor(rowIds[i], itemColor(e));
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

    private static PendingIntent widgetIntent(Context context, String action, int request) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("agenda-rjp://widget/" + action), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, request, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static String itemMeta(JSONObject event, long now, boolean compact) {
        String day = event.optString("date","").equals(format(now,"yyyy-MM-dd")) ? "Hoje" : format(event.optLong("timestamp",0),"d MMM");
        String time = event.optBoolean("allDay",false) ? "Dia inteiro" : event.optString("time","").replace(":","h");
        String source = event.optString("type",event.optString("source","RJP"));
        return day + " · " + time + (compact ? "\n" + source : " · " + source);
    }
    private static int itemColor(JSONObject event) {
        switch(event.optString("type",event.optString("source","RJP"))) {
            case "Google": return Color.parseColor("#9DC4FF");
            case "BT": return Color.parseColor("#74CBFF");
            case "CC": return Color.parseColor("#FFD187");
            case "Deslocação": case "IP": return Color.parseColor("#C8B4FF");
            case "Tarefa": return Color.parseColor("#FFE2A0");
            default: return Color.parseColor("#8FE1CE");
        }
    }
}
