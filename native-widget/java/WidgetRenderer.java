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
import java.util.Calendar;
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
        redrawMode(context, manager, manager.getAppWidgetIds(new ComponentName(context, AgendaDayWidget.class)), "day");
        redrawMode(context, manager, manager.getAppWidgetIds(new ComponentName(context, AgendaMonthWidget.class)), "month");
    }

    static void redrawMode(Context context, AppWidgetManager manager, int[] ids, String mode) {
        for(int id:ids){try{manager.updateAppWidget(id,render(context,mode));}catch(Exception ignored){}}
    }

    static void redraw(Context context, AppWidgetManager manager, int[] ids, boolean full) {
        for (int id : ids) {
            try {
                manager.updateAppWidget(id, render(context, full?"week":"three"));
            } catch (Exception ignored) {
                // Não bloquear as restantes instâncias no launcher.
            }
        }
    }

    private static Calendar newCalendar(long time) {
        Calendar c = Calendar.getInstance(LISBON, PT);
        c.setFirstDayOfWeek(Calendar.MONDAY);
        c.setMinimalDaysInFirstWeek(4);
        c.setTimeInMillis(time);
        return c;
    }
    private static RemoteViews render(Context context, String mode) {
        boolean full="week".equals(mode)||"month".equals(mode);
        boolean monthly="month".equals(mode);
        boolean daily="day".equals(mode);
        RemoteViews view = new RemoteViews(context.getPackageName(),
            monthly ? R.layout.widget_agenda_month : (full ? R.layout.widget_agenda_full : R.layout.widget_agenda_compact));
        PendingIntent click = widgetIntent(context, mode, 4500+Math.abs(mode.hashCode()%400));
        view.setOnClickPendingIntent(R.id.widget_root, click);
        if(!monthly)view.setOnClickPendingIntent(R.id.widget_ip_alerts, widgetIntent(context, "alerts", 4507));
        if("three".equals(mode))view.setOnClickPendingIntent(R.id.widget_add, widgetIntent(context, "new", 4511));
        if (full&&!monthly) {
            view.setOnClickPendingIntent(R.id.widget_open, click);
            view.setOnClickPendingIntent(R.id.widget_add, widgetIntent(context, "new", 4505));
            view.setOnClickPendingIntent(R.id.widget_voice, widgetIntent(context, "voice", 4506));
        }

        long now=System.currentTimeMillis();
        Calendar today=newCalendar(now);
        Calendar monday=newCalendar(now);
        int mondayOffset=(monday.get(Calendar.DAY_OF_WEEK)+5)%7;
        monday.add(Calendar.DAY_OF_MONTH,-mondayOffset);
        int isoWeek=monday.get(Calendar.WEEK_OF_YEAR);
        Calendar thursday=(Calendar)monday.clone();
        thursday.add(Calendar.DAY_OF_MONTH,3);
        int isoYear=thursday.get(Calendar.YEAR);
        Calendar sunday=(Calendar)monday.clone();
        sunday.add(Calendar.DAY_OF_MONTH,6);
        String header="SEMANA "+isoWeek+" · "+format(monday.getTimeInMillis(),"dd MMM")+" – "+format(sunday.getTimeInMillis(),"dd MMM")+" "+isoYear;
        if(monthly)header=format(now,"MMMM yyyy").toUpperCase(PT)+" · SEMANA "+isoWeek;
        if(daily)header=format(now,"EEEE dd MMMM")+" · SEMANA "+isoWeek;
        view.setTextViewText(R.id.widget_subtitle,header);
        if(!full)view.setTextViewText(R.id.widget_title,daily?"AGENDA · HOJE":"AGENDA · 3 DIAS");
        if(monthly)view.setTextViewText(R.id.widget_title,"Agenda RJP · Mensal");

        long updatedAt=context.getSharedPreferences("agenda_rjp_widget",Context.MODE_PRIVATE).getLong("updatedAt",0L);
        String raw=context.getSharedPreferences("agenda_rjp_widget",Context.MODE_PRIVATE).getString("events","[]");
        ArrayList<JSONObject> entries=new ArrayList<>();
        try{
            JSONArray stored=new JSONArray(raw);
            for(int i=0;i<stored.length()&&i<220;i++){
                JSONObject e=stored.optJSONObject(i);
                if(e!=null && e.optLong("timestamp",0L)>0 && !e.optString("date","").isEmpty())entries.add(e);
            }
        }catch(Exception ignored){}
        Collections.sort(entries,Comparator.comparingLong(e->e.optLong("timestamp",0L)));

        if(monthly){
            Calendar first=newCalendar(now);
            first.set(Calendar.DAY_OF_MONTH,1);
            int shownMonth=first.get(Calendar.MONTH);
            first.add(Calendar.DAY_OF_MONTH,-((first.get(Calendar.DAY_OF_WEEK)+5)%7));
            for(int i=0;i<42;i++){
                String key=format(first.getTimeInMillis(),"yyyy-MM-dd");
                int count=0;
                int color=Color.parseColor("#1967D2");
                for(JSONObject event:entries){
                    if(key.equals(event.optString("date",""))){count++;if(count==1)color=itemColor(event);}
                }
                int cell=context.getResources().getIdentifier("month_cell_"+i,"id",context.getPackageName());
                if(cell!=0){
                    String dayLabel=String.valueOf(first.get(Calendar.DAY_OF_MONTH));
                    view.setTextViewText(cell,dayLabel+(count>0?"\\n●":""));
                    boolean inMonth=first.get(Calendar.MONTH)==shownMonth;
                    boolean isToday=key.equals(format(now,"yyyy-MM-dd"));
                    view.setTextColor(cell,!inMonth?Color.parseColor("#BDC1C6"):count>0?color:isToday?Color.parseColor("#1967D2"):Color.parseColor("#202124"));
                    view.setOnClickPendingIntent(cell,widgetIntent(context,"date/"+key,6000+i));
                }
                first.add(Calendar.DAY_OF_MONTH,1);
            }
            view.setTextViewText(R.id.widget_updated,updatedAt==0L?"Abre a app para sincronizar":"Atualizado: "+format(updatedAt,"dd MMM HH:mm"));
            return view;
        }
        if("three".equals(mode)){
            String todayLabel=format(now,"EEE, dd/MM");
            view.setTextViewText(R.id.widget_title,todayLabel.substring(0,1).toUpperCase(PT)+todayLabel.substring(1));
            view.setTextViewText(R.id.widget_subtitle,"PRÓXIMAS ATIVIDADES");
            int[] cards={R.id.widget_day_1,R.id.widget_day_2,R.id.widget_day_3};
            int shown=0;
            for(JSONObject e:entries){
                if(shown>=cards.length)break;
                long stamp=e.optLong("timestamp",0L);
                if(stamp<now-3600000L)continue;
                int cell=cards[shown];
                String date=e.optString("date","");
                String label=date.equals(format(now,"yyyy-MM-dd"))?"Hoje":format(stamp,"EEE, dd/MM");
                String time=e.optBoolean("allDay",false)?"Dia inteiro":e.optString("time","");
                view.setTextViewText(cell,label+"\\n"+e.optString("title","Atividade")+"  ·  "+time);
                String id=e.optString("id","");
                String target=id.isEmpty()?"date/"+date:"event/"+Uri.encode(id);
                view.setOnClickPendingIntent(cell,widgetIntent(context,target,4700+shown));
                shown++;
            }
            if(shown==0){view.setTextViewText(cards[0],"Não há mais nada hoje");shown=1;}
            for(int i=shown;i<cards.length;i++)view.setViewVisibility(cards[i],android.view.View.GONE);
            return view;
        }
        int[] rowIds=full?
            new int[]{R.id.widget_day_1,R.id.widget_day_2,R.id.widget_day_3,R.id.widget_day_4,R.id.widget_day_5,R.id.widget_day_6,R.id.widget_day_7}:
            new int[]{R.id.widget_day_1,R.id.widget_day_2,R.id.widget_day_3};
        Calendar day=(Calendar)(full?monday:today).clone();
        if(monthly){day.set(Calendar.DAY_OF_MONTH,1);day.add(Calendar.DAY_OF_MONTH,-((day.get(Calendar.DAY_OF_WEEK)+5)%7));}
        for(int i=0;i<rowIds.length;i++){
            String key=format(day.getTimeInMillis(),"yyyy-MM-dd");
            String label=format(day.getTimeInMillis(),"EEE dd");
            JSONObject first=null;
            int count=0;
            for(JSONObject e:entries){
                if(key.equals(e.optString("date",""))){
                    count++;
                    if(first==null)first=e;
                }
            }
            String entry=first==null?(updatedAt==0L?"Abrir app para sincronizar":"Sem compromissos"):
                (first.optBoolean("allDay",false)?"Dia inteiro":first.optString("time","").replace(":","h"))+
                " · "+first.optString("title","Compromisso")+(count>1?"  +"+(count-1):"");
            if(monthly){
                Calendar end=(Calendar)day.clone();end.add(Calendar.DAY_OF_MONTH,6);
                int total=0;
                for(JSONObject e:entries){String d=e.optString("date","");if(d.compareTo(key)>=0&&d.compareTo(format(end.getTimeInMillis(),"yyyy-MM-dd"))<=0)total++;}
                view.setTextViewText(rowIds[i],format(day.getTimeInMillis(),"dd MMM")+" – "+format(end.getTimeInMillis(),"dd MMM")+"   ·   "+total+" compromisso(s)");
            }else view.setTextViewText(rowIds[i],label+"  ·  "+entry);
            if(daily&&i>0)view.setViewVisibility(rowIds[i],android.view.View.GONE);
            view.setTextColor(rowIds[i],first==null?Color.parseColor("#91A8B3"):itemColor(first));
            day.add(Calendar.DAY_OF_MONTH,monthly?7:1);
        }
        if(full)view.setTextViewText(R.id.widget_updated,updatedAt==0L?"Por sincronizar · abre a aplicação":
            "Atualizado: "+format(updatedAt,"dd MMM HH:mm")+" · Google sincronizado ao abrir a app");
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
