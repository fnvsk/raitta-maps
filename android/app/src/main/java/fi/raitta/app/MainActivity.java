package fi.raitta.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
  private float lastTop = -1;
  private float lastBottom = -1;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WebView web = getBridge().getWebView();
    web.addOnLayoutChangeListener((view, l, t, r, b, ol, ot, or, ob) -> measure(web, false));
    web.postDelayed(() -> measure(web, true), 1200);
    web.postDelayed(() -> measure(web, true), 4000);
  }

  @Override
  public void onResume() {
    super.onResume();
    WebView web = getBridge().getWebView();
    web.postDelayed(() -> measure(web, true), 300);
  }

  private void measure(WebView web, boolean always) {
    WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(web);
    if (insets == null) return;
    Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
    int[] at = new int[2];
    web.getLocationOnScreen(at);
    View root = web.getRootView();
    float density = getResources().getDisplayMetrics().density;
    float top = Math.max(0, bars.top - at[1]) / density;
    float bottom = Math.max(0, (at[1] + web.getHeight()) - (root.getHeight() - bars.bottom)) / density;
    if (!always && top == lastTop && bottom == lastBottom) return;
    lastTop = top;
    lastBottom = bottom;
    String script = String.format(
      Locale.ROOT,
      "(function(){var s=document.documentElement.style;s.setProperty('--raitta-safe-top','%.1fpx');s.setProperty('--raitta-safe-bottom','%.1fpx');})();",
      top,
      bottom
    );
    web.post(() -> web.evaluateJavascript(script, null));
  }
}
