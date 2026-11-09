package pt.rjp.daily;

import android.content.Context;
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
        getContext().getSharedPreferences("agenda_rjp_widget", Context.MODE_PRIVATE)
            .edit()
            .putString("events", events.toString())
            .putLong("updatedAt", System.currentTimeMillis())
            .apply();
        WidgetRenderer.redrawAll(getContext());
        call.resolve();
    }
}
