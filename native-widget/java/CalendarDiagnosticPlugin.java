package pt.rjp.daily;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.CalendarContract;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Read-only, local diagnostics: never queries event contents or sends data to a server. */
@CapacitorPlugin(name = "CalendarDiagnostic")
public class CalendarDiagnosticPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", ContextCompat.checkSelfPermission(getContext(),
            Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void listCalendars(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(),
            Manifest.permission.READ_CALENDAR) != PackageManager.PERMISSION_GRANTED) {
            call.reject("READ_CALENDAR_NOT_GRANTED");
            return;
        }
        JSArray calendars = new JSArray();
        String[] columns = {
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_TYPE,
            CalendarContract.Calendars.VISIBLE
        };
        try (Cursor cursor = getContext().getContentResolver().query(
                CalendarContract.Calendars.CONTENT_URI, columns, null, null, null)) {
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    JSObject entry = new JSObject();
                    entry.put("id", cursor.getLong(0));
                    entry.put("name", cursor.getString(1));
                    entry.put("accountType", cursor.getString(2));
                    entry.put("visible", cursor.getInt(3) == 1);
                    calendars.put(entry);
                }
            }
            JSObject result = new JSObject();
            result.put("calendars", calendars);
            call.resolve(result);
        } catch (SecurityException ex) {
            call.reject("CALENDAR_ACCESS_BLOCKED");
        } catch (Exception ex) {
            call.reject("CALENDAR_QUERY_FAILED");
        }
    }
}
