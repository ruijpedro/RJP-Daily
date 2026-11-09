package pt.rjp.daily;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AgendaWidget")
public class AgendaWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        JSArray events = call.getArray("events");
        if (events == null) {
            call.reject("A lista de compromissos é obrigatória.");
            return;
        }
        JSONArray output = new JSONArray();
        try {
            for (int i=0; i<events.length(); i++) {
                JSONObject item = events.optJSONObject(i);
                if (item != null) output.put(item);
            }
            // Com a conta Google temporariamente desligada, mantém os últimos
            // compromissos já sincronizados até nova autorização na aplicação.
            if (Boolean.TRUE.equals(call.getBoolean("retainGoogle", false))) {
                String previous = getContext().getSharedPreferences("agenda_rjp_widget",
                    Context.MODE_PRIVATE).getString("events", "[]");
                JSONArray cache = new JSONArray(previous);
                for (int i=0; i<cache.length(); i++) {
                    JSONObject item = cache.optJSONObject(i);
                    if (item != null && "Google".equals(item.optString("source"))) {
                        boolean exists=false;
                        for (int j=0; j<output.length(); j++) {
                            JSONObject fresh=output.optJSONObject(j);
                            if (fresh != null &&
                                fresh.optString("title").equals(item.optString("title")) &&
                                fresh.optString("date").equals(item.optString("date"))) {
                                exists=true;break;
                            }
                        }
                        if (!exists) output.put(item);
                    }
                }
            }
            getContext().getSharedPreferences("agenda_rjp_widget", Context.MODE_PRIVATE)
                .edit().putString("events", output.toString())
                .putLong("updatedAt", System.currentTimeMillis()).apply();
            WidgetRenderer.redrawAll(getContext());
            call.resolve();
        } catch (Exception ex) {
            call.reject("Não foi possível atualizar o widget.");
        }
    }

    @PluginMethod
    public void clearGoogle(PluginCall call) {
        try {
            JSONArray stored = new JSONArray(getContext().getSharedPreferences("agenda_rjp_widget",
                Context.MODE_PRIVATE).getString("events","[]"));
            JSONArray kept = new JSONArray();
            for (int i=0;i<stored.length();i++) {
                JSONObject item=stored.optJSONObject(i);
                if (item != null && !"Google".equals(item.optString("source"))) kept.put(item);
            }
            getContext().getSharedPreferences("agenda_rjp_widget", Context.MODE_PRIVATE)
                .edit().putString("events", kept.toString()).apply();
            WidgetRenderer.redrawAll(getContext());
            call.resolve();
        }catch(Exception error) {
            call.reject("Não foi possível limpar compromissos Google do widget.");
        }
    }
}
