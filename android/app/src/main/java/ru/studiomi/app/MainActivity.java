package ru.studiomi.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.bottomsheet.BottomSheetDialog;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import javax.net.ssl.HttpsURLConnection;

public class MainActivity extends AppCompatActivity {

    private static final String HOME_URL = "https://studiomi.ru/";
    private static final int FILE_CHOOSER_CODE = 101;

    private static final String APP_VERSION = "2.1";

    private static final String FALLBACK_PHONE_DISPLAY = "+7 (933) 430-47-77";
    private static final String FALLBACK_DIKIDI = "https://dikidi.net/2049120?p=0.pi";

    private static final int PAD16 = 16;
    private static final int PAD12 = 12;

    private static final String DATA_JS = """
            (function(){
              var push=function(obj){ try{ AppBridge.data(JSON.stringify(obj)); }catch(e){} };
              var cfg={};
              try{
                if(typeof CONFIG!=='undefined'){
                  cfg.phones=(CONFIG.phones&&CONFIG.phones.length)?CONFIG.phones:['+7 (933) 430-47-77'];
                  cfg.schedule=CONFIG.schedule||'';
                  cfg.address=CONFIG.address||'';
                  cfg.hook=CONFIG.leadWebhookUrl||'';
                  cfg.diki=CONFIG.dikidiUrl||'';
                  cfg.book=CONFIG.bookingUrl||'';
                  cfg.vk=CONFIG.vkUrl||'';
                  cfg.tg=CONFIG.tgUrl||'';
                }
              }catch(e){}
              try{ cfg.services=getServices(); }catch(e){ cfg.services=[]; }
              try{ cfg.promos=getPromos().map(function(p){
                    return {b:p.badge||'',t:p.tag||'',title:p.title||'',d:p.desc||'',n:p.note||''};
              }); }catch(e){ cfg.promos=[]; }
              try{ cfg.works=getPortfolioItems().map(function(w){
                    return {id:w.id||'',image:w.image||''};
              }); }catch(e){ cfg.works=[]; }
              push(cfg);
            })();
            """;

    private BottomNavigationView nav;
    private TextView netBanner;
    private TextView homeSchedule;
    private TextView homeAddress;
    private LinearLayout promosRow;
    private LinearLayout svcList;
    private LinearLayout worksGrid;
    private LinearLayout contactsList;
    private View pageHome, pageServices, pageWorks, pageContacts;
    private FrameLayout pagesHolder;
    private androidx.appcompat.widget.Toolbar toolbar;
    private WebView loader;
    private ValueCallback<Uri[]> fileCallback;

    private volatile List<String> cfgPhones = new ArrayList<>();
    private volatile String cfgHook = "";
    private volatile String cfgDiki = "";
    private volatile String cfgBook = "";
    private volatile String cfgVk = "";
    private volatile String cfgTg = "";
    private volatile String cfgAddress = "";
    private volatile List<JSONObject> servicesData = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        nav = findViewById(R.id.nav);
        netBanner = findViewById(R.id.net_banner);
        pageHome = findViewById(R.id.page_home);
        pageServices = findViewById(R.id.page_services);
        pageWorks = findViewById(R.id.page_works);
        pageContacts = findViewById(R.id.page_contacts);
        pagesHolder = findViewById(R.id.pages_holder);
        toolbar = findViewById(R.id.toolbar);
        homeSchedule = findViewById(R.id.home_schedule);
        homeAddress = findViewById(R.id.home_address);
        promosRow = findViewById(R.id.promos_row);
        svcList = findViewById(R.id.svc_list);
        worksGrid = findViewById(R.id.works_grid);
        contactsList = findViewById(R.id.contacts_list);

        Button btnBook = findViewById(R.id.btn_book);
        btnBook.setOnClickListener(v -> showBookingSheet());

        toolbar.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_refresh) {
                reloadLoader();
                return true;
            }
            return false;
        });

        findViewById(R.id.btn_call).setOnClickListener(v -> showCallDialog());

        nav.setOnItemSelectedListener(item -> {
            showPage(item.getItemId());
            return true;
        });

        positionCallButton();

        initLoader();
        showPage(R.id.nav_home);
    }

    private void positionCallButton() {
        View callWrap = findViewById(R.id.call_wrap);
        Runnable place = () -> callWrap.setTranslationY(-(nav.getHeight() / 2f));
        nav.post(place);
        nav.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or2, ob) -> place.run());
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void initLoader() {
        loader = new WebView(this);
        WebSettings s = loader.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);

        loader.addJavascriptInterface(new Bridge(), "AppBridge");
        loader.setLayoutParams(new FrameLayout.LayoutParams(1, 1));
        loader.setVisibility(View.INVISIBLE);
        loader.setAlpha(0f);

        loader.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true; // загрузчик никуда не ходит
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(DATA_JS, null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) netBanner.setVisibility(View.VISIBLE);
            }
        });

        pagesHolder.addView(loader);
        loader.loadUrl(HOME_URL);
    }

    private void reloadLoader() {
        if (loader != null) loader.reload();
    }

    private void showPage(int itemId) {
        pageHome.setVisibility(itemId == R.id.nav_home ? View.VISIBLE : View.GONE);
        pageServices.setVisibility(itemId == R.id.nav_services ? View.VISIBLE : View.GONE);
        pageWorks.setVisibility(itemId == R.id.nav_works ? View.VISIBLE : View.GONE);
        pageContacts.setVisibility(itemId == R.id.nav_contacts ? View.VISIBLE : View.GONE);
        if (itemId == R.id.nav_services && svcList.getChildCount() == 0) renderServices();
        if (itemId == R.id.nav_contacts && contactsList.getChildCount() == 0) renderContacts();
    }

    private static boolean isInternalHost(String host) {
        return host.equals("studiomi.ru")
                || host.equals("www.studiomi.ru")
                || host.endsWith(".studiomi.ru")
                || host.equals("yandex.ru")
                || host.endsWith(".yandex.ru")
                || host.endsWith(".yastatic.net");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    private static String abs(String u) {
        if (u == null || u.isEmpty()) return "";
        if (u.startsWith("data:") || u.startsWith("http://") || u.startsWith("https://")) return u;
        return HOME_URL + (u.startsWith("/") ? u.substring(1) : u);
    }

    private String normalizedPhone(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return "";
        if (digits.startsWith("8")) digits = "7" + digits.substring(1);
        if (!digits.startsWith("7")) digits = "7" + digits;
        return "+" + digits;
    }

    private void showCallDialog() {
        List<String> phones = new ArrayList<>(cfgPhones);
        if (phones.isEmpty()) phones.add(FALLBACK_PHONE_DISPLAY);
        String[] items = phones.toArray(new String[0]);
        new AlertDialog.Builder(this)
                .setTitle(R.string.calling)
                .setItems(items, (d, which) ->
                        openExternal(Uri.parse("tel:" + normalizedPhone(items[which]))))
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    // ---------- Нативные экраны ----------

    private TextView text(String value, float sp, int color, boolean bold) {
        TextView tv = new TextView(this);
        tv.setText(value);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        tv.setTextColor(color);
        if (bold) tv.setTypeface(Typeface.DEFAULT_BOLD);
        return tv;
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackgroundResource(R.drawable.bg_card);
        int p = dp(PAD16);
        card.setPadding(p, p, p, p);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(PAD12);
        card.setLayoutParams(lp);
        return card;
    }

    private void renderServices() {
        if (servicesData.isEmpty()) {
            TextView empty = text(getString(R.string.net_banner), 13f, 0xFF9E9A94, false);
            svcList.addView(empty);
            return;
        }
        for (JSONObject cat : servicesData) {
            LinearLayout c = card();
            LinearLayout head = new LinearLayout(this);
            head.setOrientation(LinearLayout.HORIZONTAL);
            head.setGravity(android.view.Gravity.CENTER_VERTICAL);

            LinearLayout titles = new LinearLayout(this);
            titles.setOrientation(LinearLayout.VERTICAL);
            titles.setLayoutParams(new LinearLayout.LayoutParams(0,
                    LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            titles.addView(text(cat.optString("title"), 17f, 0xFF1A1A1A, true));
            String sd = cat.optString("shortDesc");
            if (!sd.isEmpty()) {
                TextView t = text(sd, 13f, 0xFF5A564F, false);
                t.setMaxLines(3);
                titles.addView(t);
            }
            TextView chev = text("▾", 18f, 0xFFB8975A, true);
            head.addView(titles);
            head.addView(chev);
            c.addView(head);

            LinearLayout body = new LinearLayout(this);
            body.setOrientation(LinearLayout.VERTICAL);
            body.setVisibility(View.GONE);
            final boolean[] built = {false};
            head.setOnClickListener(v -> {
                boolean opening = body.getVisibility() != View.VISIBLE;
                if (opening && !built[0]) {
                    buildServiceBody(cat, body);
                    built[0] = true;
                }
                body.setVisibility(opening ? View.VISIBLE : View.GONE);
                chev.setText(opening ? "▴" : "▾");
            });
            c.addView(body);
            svcList.addView(c);
        }
    }

    private void buildServiceBody(JSONObject cat, LinearLayout body) {
        JSONArray price = cat.optJSONArray("price");
        if (price != null) {
            for (int i = 0; i < price.length(); i++) {
                JSONObject sec = price.optJSONObject(i);
                if (sec == null) continue;
                TextView sh = text(sec.optString("section"), 13f, 0xFFB8975A, true);
                sh.setAllCaps(true);
                LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT);
                slp.topMargin = dp(PAD12);
                slp.bottomMargin = dp(6);
                body.addView(sh, slp);

                JSONArray items = sec.optJSONArray("items");
                if (items == null) continue;
                for (int j = 0; j < items.length(); j++) {
                    JSONObject it = items.optJSONObject(j);
                    if (it == null) continue;
                    LinearLayout row = new LinearLayout(this);
                    row.setOrientation(LinearLayout.HORIZONTAL);
                    row.setGravity(android.view.Gravity.TOP);

                    LinearLayout names = new LinearLayout(this);
                    names.setOrientation(LinearLayout.VERTICAL);
                    names.setLayoutParams(new LinearLayout.LayoutParams(0,
                            LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
                    names.addView(text(it.optString("name"), 14f, 0xFF1A1A1A, false));
                    String meta = it.optString("meta");
                    if (!meta.isEmpty()) names.addView(text(meta, 11f, 0xFF9E9A94, false));
                    row.addView(names);

                    TextView pr = text(it.optString("price"), 14f, 0xFFB8975A, true);
                    pr.setLayoutParams(new LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT));
                    row.addView(pr);
                    body.addView(row);
                }
            }
        }
        JSONArray masters = cat.optJSONArray("masters");
        if (masters != null && masters.length() > 0) {
            TextView mh = text(getString(R.string.masters_label), 13f, 0xFFB8975A, true);
            mh.setAllCaps(true);
            LinearLayout.LayoutParams mlp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            mlp.topMargin = dp(PAD12 + 4);
            mlp.bottomMargin = dp(6);
            body.addView(mh, mlp);

            for (int k = 0; k < masters.length(); k++) {
                JSONObject m = masters.optJSONObject(k);
                if (m == null) continue;
                LinearLayout row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(android.view.Gravity.CENTER_VERTICAL);

                ImageView photo = new ImageView(this);
                int sz = dp(52);
                LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(sz, sz);
                plp.rightMargin = dp(PAD12);
                photo.setLayoutParams(plp);
                photo.setBackgroundResource(R.drawable.bg_img_ph);
                photo.setClipToOutline(true);
                MiniImg.load(photo, abs(m.optString("photo")));
                row.addView(photo);

                LinearLayout info = new LinearLayout(this);
                info.setOrientation(LinearLayout.VERTICAL);
                info.setLayoutParams(new LinearLayout.LayoutParams(0,
                        LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
                info.addView(text(m.optString("name"), 14f, 0xFF1A1A1A, true));
                String md = m.optString("desc");
                if (!md.isEmpty()) info.addView(text(md, 11f, 0xFF9E9A94, false));
                row.addView(info);
                body.addView(row);
            }
        }
    }

    private void renderWorks(List<JSONObject> items) {
        worksGrid.removeAllViews();
        if (items.isEmpty()) {
            worksGrid.addView(text(getString(R.string.net_banner), 13f, 0xFF9E9A94, false));
            return;
        }
        List<String> urls = new ArrayList<>();
        for (JSONObject w : items) {
            String u = abs(w.optString("image"));
            if (!u.isEmpty()) urls.add(u);
        }
        for (int i = 0; i < urls.size(); i += 2) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            rlp.bottomMargin = dp(8);
            row.setLayoutParams(rlp);

            for (int j = i; j < Math.min(i + 2, urls.size()); j++) {
                ImageView iv = new ImageView(this);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(170), 1f);
                lp.leftMargin = dp(j % 2 == 1 ? 4 : 0);
                lp.rightMargin = dp(j % 2 == 0 ? 4 : 0);
                iv.setLayoutParams(lp);
                iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
                MiniImg.load(iv, urls.get(j));
                String url = urls.get(j);
                iv.setOnClickListener(v -> showViewer(url));
                row.addView(iv);
            }
            worksGrid.addView(row);
        }
    }

    private void showViewer(String url) {
        AlertDialog d = new AlertDialog.Builder(this).create();
        ImageView iv = new ImageView(this);
        iv.setBackgroundColor(0xFF000000);
        iv.setAdjustViewBounds(true);
        iv.setOnClickListener(v -> d.dismiss());
        MiniImg.load(iv, url);
        d.setView(iv);
        d.show();
    }

    private void renderContacts() {
        contactsList.removeAllViews();

        for (String phone : cfgPhones) {
            LinearLayout c = card();
            c.addView(text("📞 Телефон", 12f, 0xFF9E9A94, false));
            TextView p = text(phone, 17f, 0xFF1A1A1A, true);
            p.setPadding(0, dp(4), 0, 0);
            c.addView(p);
            c.setOnClickListener(v ->
                    openExternal(Uri.parse("tel:" + normalizedPhone(phone))));
            contactsList.addView(c);
        }

        LinearLayout schedCard = card();
        schedCard.addView(text("🕐 Часы работы", 12f, 0xFF9E9A94, false));
        TextView sched = text(homeSchedule.getText().toString(), 15f, 0xFF1A1A1A, true);
        sched.setPadding(0, dp(4), 0, 0);
        schedCard.addView(sched);
        contactsList.addView(schedCard);

        LinearLayout addrCard = card();
        addrCard.addView(text("📍 Адрес", 12f, 0xFF9E9A94, false));
        TextView addr = text(homeAddress.getText().toString(), 15f, 0xFF1A1A1A, true);
        addr.setPadding(0, dp(4), 0, 0);
        addrCard.addView(addr);
        TextView mapBtn = text(getString(R.string.open_map), 13f, 0xFFB8975A, true);
        mapBtn.setPadding(0, dp(8), 0, 0);
        addrCard.addView(mapBtn);
        addrCard.setOnClickListener(v -> {
            try {
                String q = Uri.encode(homeAddress.getText().toString());
                startActivity(new Intent(Intent.ACTION_VIEW,
                        Uri.parse("geo:0,0?q=" + q)));
            } catch (ActivityNotFoundException e) {
                openExternal(Uri.parse("https://yandex.ru/maps/?text="
                        + Uri.encode(homeAddress.getText().toString())));
            }
        });
        contactsList.addView(addrCard);

        if (!cfgVk.isEmpty() || !cfgTg.isEmpty()) {
            LinearLayout soc = card();
            soc.addView(text("Мы в соцсетях", 12f, 0xFF9E9A94, false));
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            rlp.topMargin = dp(PAD12);
            row.setLayoutParams(rlp);
            if (!cfgVk.isEmpty()) row.addView(socialBtn("VK", R.drawable.bg_social_vk, cfgVk));
            if (!cfgTg.isEmpty()) row.addView(socialBtn("TG", R.drawable.bg_social_tg, cfgTg));
            soc.addView(row);
            contactsList.addView(soc);
        }

        String onlineUrl = !cfgBook.isEmpty() ? cfgBook : cfgDiki;
        if (!onlineUrl.isEmpty()) {
            Button b = new Button(this);
            b.setText(R.string.online_booking);
            b.setTextColor(0xFFFFFFFF);
            b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xFFB8975A));
            LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, dp(50));
            blp.topMargin = dp(4);
            b.setLayoutParams(blp);
            b.setOnClickListener(v -> openExternal(Uri.parse(onlineUrl)));
            contactsList.addView(b);
        }
    }

    private TextView socialBtn(String label, int bgRes, String url) {
        TextView tv = new TextView(this);
        tv.setText(label);
        tv.setTextColor(0xFFFFFFFF);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setBackgroundResource(bgRes);
        tv.setGravity(android.view.Gravity.CENTER);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(56), dp(56));
        lp.rightMargin = dp(PAD12);
        tv.setLayoutParams(lp);
        tv.setOnClickListener(v -> openExternal(Uri.parse(url)));
        return tv;
    }

    // ---------- Запись ----------

    private void showBookingSheet() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View content = getLayoutInflater().inflate(R.layout.sheet_booking, null, false);
        dialog.setContentView(content);

        EditText etName = content.findViewById(R.id.et_name);
        EditText etPhone = content.findViewById(R.id.et_phone);
        EditText etTime = content.findViewById(R.id.et_time);
        EditText etComment = content.findViewById(R.id.et_comment);
        Spinner spService = content.findViewById(R.id.sp_service);
        Button btnSend = content.findViewById(R.id.btn_lead_send);
        Button btnOnline = content.findViewById(R.id.btn_online);

        List<String> items = new ArrayList<>();
        items.add("Пока не знаю — нужна консультация");
        synchronized (this) {
            for (JSONObject s : servicesData) items.add(s.optString("title"));
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_item, items);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spService.setAdapter(adapter);

        btnSend.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            String phone = etPhone.getText().toString().trim();
            if (name.isEmpty() || phone.isEmpty()) {
                Toast.makeText(this, R.string.fill_fields, Toast.LENGTH_SHORT).show();
                return;
            }
            Object sel = spService.getSelectedItem();
            String service = sel == null ? "" : sel.toString();
            sendLead(dialog, name, phone, service,
                    etTime.getText().toString().trim(),
                    etComment.getText().toString().trim());
        });

        btnOnline.setOnClickListener(v -> {
            String url = !cfgBook.isEmpty() ? cfgBook : cfgDiki;
            if (!url.isEmpty()) openExternal(Uri.parse(url));
            dialog.dismiss();
        });

        dialog.show();
    }

    private void sendLead(BottomSheetDialog dialog, String name, String phone,
                          String service, String time, String comment) {
        if (cfgHook.isEmpty()) {
            Toast.makeText(this, R.string.sent_fail, Toast.LENGTH_LONG).show();
            return;
        }
        String hook = cfgHook;
        Toast.makeText(this, "Отправляю…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            boolean ok;
            try {
                JSONObject payload = new JSONObject();
                payload.put("name", name);
                payload.put("phone", phone);
                payload.put("service", service);
                payload.put("visit_time", time);
                payload.put("comment", comment);
                payload.put("_hp", "");
                payload.put("_ts", System.currentTimeMillis());
                payload.put("source", "android-app");
                payload.put("version", APP_VERSION);

                HttpsURLConnection c =
                        (HttpsURLConnection) new java.net.URL(hook).openConnection();
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json;charset=utf-8");
                c.setDoOutput(true);
                c.setConnectTimeout(10000);
                c.setReadTimeout(15000);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                }
                int code = c.getResponseCode();
                c.disconnect();
                ok = code >= 200 && code < 400;
            } catch (Exception e) {
                ok = false;
            }
            boolean finalOk = ok;
            runOnUiThread(() -> {
                if (finalOk) {
                    Toast.makeText(this, R.string.sent_ok, Toast.LENGTH_LONG).show();
                    dialog.dismiss();
                } else {
                    Toast.makeText(this, R.string.sent_fail, Toast.LENGTH_LONG).show();
                }
            });
        }).start();
    }

    // ---------- JS-мост ----------

    private class Bridge {
        @android.webkit.JavascriptInterface
        public void data(String json) {
            try {
                JSONObject o = new JSONObject(json);

                JSONArray phones = o.optJSONArray("phones");
                if (phones != null && phones.length() > 0) {
                    List<String> list = new ArrayList<>();
                    for (int i = 0; i < phones.length(); i++) list.add(phones.getString(i));
                    cfgPhones = list;
                }
                cfgHook = o.optString("hook", "");
                String d = o.optString("diki", "");
                if (!d.isEmpty()) cfgDiki = d;
                cfgBook = o.optString("book", "");
                cfgVk = o.optString("vk", "");
                cfgTg = o.optString("tg", "");
                final String sched = o.optString("schedule", "");
                final String addr = o.optString("address", "");
                cfgAddress = addr;

                JSONArray svcs = o.optJSONArray("services");
                final List<JSONObject> svcList2 = new ArrayList<>();
                if (svcs != null) {
                    for (int i = 0; i < svcs.length(); i++)
                        svcList2.add(svcs.optJSONObject(i));
                }
                servicesData = svcList2;

                runOnUiThread(() -> {
                    if (!sched.isEmpty()) homeSchedule.setText(sched);
                    if (!addr.isEmpty()) homeAddress.setText(addr);
                    netBanner.setVisibility(View.GONE);
                    svcList.removeAllViews();
                    renderServices();
                    renderContacts();
                });

                JSONArray promos = o.optJSONArray("promos");
                if (promos != null) {
                    final List<JSONObject> plist = new ArrayList<>();
                    for (int i = 0; i < promos.length(); i++)
                        plist.add(promos.optJSONObject(i));
                    runOnUiThread(() -> renderPromos(plist));
                }

                JSONArray works = o.optJSONArray("works");
                if (works != null) {
                    final List<JSONObject> wlist = new ArrayList<>();
                    for (int i = 0; i < works.length(); i++)
                        wlist.add(works.optJSONObject(i));
                    runOnUiThread(() -> renderWorks(wlist));
                }
            } catch (Exception ignored) {
            }
        }
    }

    private void renderPromos(List<JSONObject> items) {
        promosRow.removeAllViews();
        LayoutInflater inf = getLayoutInflater();
        for (JSONObject o : items) {
            View card = inf.inflate(R.layout.item_promo, promosRow, false);
            ((TextView) card.findViewById(R.id.promo_badge)).setText(o.optString("b"));
            ((TextView) card.findViewById(R.id.promo_tag)).setText(o.optString("t"));
            ((TextView) card.findViewById(R.id.promo_title)).setText(o.optString("title"));
            ((TextView) card.findViewById(R.id.promo_desc)).setText(o.optString("d"));
            TextView note = card.findViewById(R.id.promo_note);
            String n = o.optString("n");
            note.setText(n);
            note.setVisibility(n.isEmpty() ? View.GONE : View.VISIBLE);
            card.setOnClickListener(v -> showBookingSheet());
            promosRow.addView(card);
        }
    }

    // ---------- Служебное ----------

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics()));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
    }
}
