package ru.studiomi.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final String HOME_URL = "https://studiomi.ru/";
    private static final String APP_VERSION = "2.2.1";

    private static final String FALLBACK_PHONE_DISPLAY = "+7 (933) 430-47-77";
    private static final String FALLBACK_DIKIDI = "https://dikidi.net/2049120?p=0.pi";

    private static final int TAB_HOME = 0;
    private static final int TAB_SERVICES = 1;
    private static final int TAB_WORKS = 2;
    private static final int TAB_CONTACTS = 3;

    private static final int PAD12 = 12, PAD16 = 16;
    private static final int GOLD = 0xFFB8975A, TEXT = 0xFF1A1A1A,
            GRAY = 0xFF9E9A94, BODY = 0xFF5A564F;

    private static final String BOOKING_JS = """
            (function(){
              var st=document.createElement('style');
              st.textContent='header.header,footer.footer,#float-root,.mobile-cta,.section,.hero{display:none!important}'
                +'body{background:#FAF9F6!important}';
              document.head.appendChild(st);
              setTimeout(function(){
                try{ openPopup(document.getElementById('lead-popup')); }catch(e){}
              },700);
              document.addEventListener('click',function(e){
                if(e.target&&e.target.closest&&e.target.closest('[data-close-popup]')){
                  try{ AppBridge.closeLead(); }catch(err){}
                }
              },true);
            })();
            """;

    private static final String DATA_JS = """
            (function(){
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
              try{
                var hs=['.hero__plane--front img','.hero__plane--mid img','.hero__plane--back img'];
                cfg.heroImg='';
                for(var i=0;i<hs.length;i++){
                  var el=document.querySelector(hs[i]);
                  if(el&&el.getAttribute('src')){cfg.heroImg=el.getAttribute('src');break;}
                }
              }catch(e){}
              try{ AppBridge.data(JSON.stringify(cfg)); }catch(e){}
            })();
            """;

    private androidx.appcompat.widget.Toolbar toolbar;
    private TextView netBanner;
    private TextView homeSchedule;
    private TextView homeAddress;
    private ImageView homePhoto;
    private LinearLayout promosRow;
    private LinearLayout svcList;
    private LinearLayout worksGrid;
    private LinearLayout contactsList;
    private View pageHome, pageServices, pageWorks, pageContacts;
    private FrameLayout pagesHolder;
    private WebView loader;
    private BottomSheetDialog bookingDialog;

    private View[] tabs;
    private int currentTab = TAB_HOME;

    private volatile List<String> cfgPhones = new ArrayList<>();
    private volatile String cfgHook = "";
    private volatile String cfgDiki = "";
    private volatile String cfgBook = "";
    private volatile String cfgVk = "";
    private volatile String cfgTg = "";
    private volatile List<JSONObject> servicesData = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // статус-бар и системные бары НЕ перекрывают приложение (targetSdk 35 включает edge-to-edge)
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        setContentView(R.layout.activity_main);

        toolbar = findViewById(R.id.toolbar);
        netBanner = findViewById(R.id.net_banner);
        pageHome = findViewById(R.id.page_home);
        pageServices = findViewById(R.id.page_services);
        pageWorks = findViewById(R.id.page_works);
        pageContacts = findViewById(R.id.page_contacts);
        pagesHolder = findViewById(R.id.pages_holder);
        homeSchedule = findViewById(R.id.home_schedule);
        homeAddress = findViewById(R.id.home_address);
        homePhoto = findViewById(R.id.home_photo);
        promosRow = findViewById(R.id.promos_row);
        svcList = findViewById(R.id.svc_list);
        worksGrid = findViewById(R.id.works_grid);
        contactsList = findViewById(R.id.contacts_list);

        tabs = new View[]{
                findViewById(R.id.tab_home),
                findViewById(R.id.tab_services),
                findViewById(R.id.tab_works),
                findViewById(R.id.tab_contacts)
        };
        int[] tabIds = {R.id.tab_home, R.id.tab_services, R.id.tab_works, R.id.tab_contacts};
        for (int i = 0; i < tabs.length; i++) {
            final int which = i;
            tabs[i].setOnClickListener(v -> selectTab(which));
        }
        findViewById(R.id.btn_call).setOnClickListener(v -> showCallDialog());

        Button btnBook = findViewById(R.id.btn_book);
        btnBook.setOnClickListener(v -> showSiteBooking());

        toolbar.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_refresh) {
                reloadLoader();
                return true;
            }
            return false;
        });

        initLoader();
        selectTab(TAB_HOME);
    }

    private void selectTab(int which) {
        currentTab = which;
        for (int i = 0; i < tabs.length; i++) {
            tabs[i].setSelected(i == which);
        }
        showPage(which);
    }

    private void showPage(int which) {
        pageHome.setVisibility(which == TAB_HOME ? View.VISIBLE : View.GONE);
        pageServices.setVisibility(which == TAB_SERVICES ? View.VISIBLE : View.GONE);
        pageWorks.setVisibility(which == TAB_WORKS ? View.VISIBLE : View.GONE);
        pageContacts.setVisibility(which == TAB_CONTACTS ? View.VISIBLE : View.GONE);

        switch (which) {
            case TAB_HOME:
                toolbar.setTitle(R.string.app_name);
                break;
            case TAB_SERVICES:
                toolbar.setTitle(R.string.tab_services);
                if (svcList.getChildCount() == 0) renderServices();
                break;
            case TAB_WORKS:
                toolbar.setTitle(R.string.works_title);
                break;
            case TAB_CONTACTS:
                toolbar.setTitle(R.string.contacts_title);
                if (contactsList.getChildCount() == 0) renderContacts();
                break;
        }
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
                return true;
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
        new MaterialAlertDialogBuilder(this)
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
        svcList.removeAllViews();
        if (servicesData.isEmpty()) {
            svcList.addView(text(getString(R.string.net_banner), 13f, GRAY, false));
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
            titles.addView(text(cat.optString("title"), 17f, TEXT, true));
            String sd = cat.optString("shortDesc");
            if (!sd.isEmpty()) {
                TextView t = text(sd, 13f, BODY, false);
                t.setMaxLines(3);
                titles.addView(t);
            }
            TextView chev = text("▾", 18f, GOLD, true);
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
        JSONArray masters = cat.optJSONArray("masters");
        if (masters != null && masters.length() > 0) {
            TextView mh = text(getString(R.string.masters_label), 13f, GOLD, true);
            mh.setAllCaps(true);
            LinearLayout.LayoutParams mlp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
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
                info.addView(text(m.optString("name"), 14f, TEXT, true));
                String md = m.optString("desc");
                if (!md.isEmpty()) info.addView(text(md, 11f, GRAY, false));
                row.addView(info);
                body.addView(row);
            }
        }
        JSONArray price = cat.optJSONArray("price");
        if (price != null) {
            for (int i = 0; i < price.length(); i++) {
                JSONObject sec = price.optJSONObject(i);
                if (sec == null) continue;
                TextView sh = text(sec.optString("section"), 13f, GOLD, true);
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
                    names.addView(text(it.optString("name"), 14f, TEXT, false));
                    String meta = it.optString("meta");
                    if (!meta.isEmpty()) names.addView(text(meta, 11f, GRAY, false));
                    row.addView(names);

                    TextView pr = text(it.optString("price"), 14f, GOLD, true);
                    pr.setLayoutParams(new LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT));
                    row.addView(pr);
                    body.addView(row);
                }
            }
        }
    }

    private void renderWorks(List<JSONObject> items) {
        worksGrid.removeAllViews();
        if (items.isEmpty()) {
            worksGrid.addView(text(getString(R.string.net_banner), 13f, GRAY, false));
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
            c.addView(text("📞 Телефон", 12f, GRAY, false));
            TextView p = text(phone, 17f, TEXT, true);
            p.setPadding(0, dp(4), 0, 0);
            c.addView(p);
            c.setOnClickListener(v ->
                    openExternal(Uri.parse("tel:" + normalizedPhone(phone))));
            contactsList.addView(c);
        }

        LinearLayout schedCard = card();
        schedCard.addView(text("🕐 Часы работы", 12f, GRAY, false));
        TextView sched = text(homeSchedule.getText().toString(), 15f, TEXT, true);
        sched.setPadding(0, dp(4), 0, 0);
        schedCard.addView(sched);
        contactsList.addView(schedCard);

        LinearLayout addrCard = card();
        addrCard.addView(text("📍 Адрес", 12f, GRAY, false));
        TextView addr = text(homeAddress.getText().toString(), 15f, TEXT, true);
        addr.setPadding(0, dp(4), 0, 0);
        addrCard.addView(addr);
        TextView mapBtn = text(getString(R.string.open_map), 13f, GOLD, true);
        mapBtn.setPadding(0, dp(8), 0, 0);
        addrCard.addView(mapBtn);
        addrCard.setOnClickListener(v -> {
            try {
                String q = Uri.encode(homeAddress.getText().toString());
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + q)));
            } catch (ActivityNotFoundException e) {
                openExternal(Uri.parse("https://yandex.ru/maps/?text="
                        + Uri.encode(homeAddress.getText().toString())));
            }
        });
        contactsList.addView(addrCard);

        if (!cfgVk.isEmpty() || !cfgTg.isEmpty()) {
            LinearLayout soc = card();
            soc.addView(text("Мы в соцсетях", 12f, GRAY, false));
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
            b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(GOLD));
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

    // ---------- Запись (сайтова форма «Запись на визит») ----------

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void showSiteBooking() {
        if (bookingDialog != null) return;
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        bookingDialog = dialog;

        WebView wv = new WebView(this);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        wv.addJavascriptInterface(new Bridge(), "AppBridge");

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (scheme != null && !"http".equals(scheme) && !"https".equals(scheme)) {
                    openExternal(uri);
                    return true;
                }
                String host = uri.getHost();
                boolean internal = host != null && (host.equals("studiomi.ru")
                        || host.endsWith(".studiomi.ru"));
                if (!internal) {
                    openExternal(uri);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(BOOKING_JS, null);
            }
        });

        int h = (int) (getResources().getDisplayMetrics().heightPixels * 0.9);
        dialog.setContentView(wv, new LinearLayout.LayoutParams(-1, h));
        dialog.setOnDismissListener(d -> bookingDialog = null);
        dialog.show();

        View bs = dialog.findViewById(com.google.android.material.R.id.design_bottom_sheet);
        if (bs != null) {
            com.google.android.material.bottomsheet.BottomSheetBehavior<View> bh =
                    com.google.android.material.bottomsheet.BottomSheetBehavior.from(bs);
            // свайп вниз не закрывает форму: шторка жёстко зафиксирована раскрытой,
            // контент листается только внутри сайта; закрытие — ✕ или «Назад»
            bh.setHideable(false);
            bh.setState(com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_EXPANDED);
            final com.google.android.material.bottomsheet.BottomSheetBehavior<View> fbh = bh;
            bh.addBottomSheetCallback(
                    new com.google.android.material.bottomsheet.BottomSheetBehavior.BottomSheetCallback() {
                @Override
                public void onStateChanged(@NonNull View sheet, int newState) {
                    if (newState != com.google.android.material.bottomsheet
                            .BottomSheetBehavior.STATE_EXPANDED) {
                        fbh.setState(com.google.android.material.bottomsheet
                                .BottomSheetBehavior.STATE_EXPANDED);
                    }
                }

                @Override
                public void onSlide(@NonNull View sheet, float slideOffset) {
                }
            });
        }
        wv.loadUrl(HOME_URL);
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

                JSONArray svcs = o.optJSONArray("services");
                final List<JSONObject> svcData = new ArrayList<>();
                if (svcs != null) {
                    for (int i = 0; i < svcs.length(); i++)
                        svcData.add(svcs.optJSONObject(i));
                }
                servicesData = svcData;

                JSONArray works = o.optJSONArray("works");
                final List<JSONObject> wlist = new ArrayList<>();
                if (works != null) {
                    for (int i = 0; i < works.length(); i++)
                        wlist.add(works.optJSONObject(i));
                }

                String heroImg = o.optString("heroImg", "");
                if (heroImg.isEmpty() && !wlist.isEmpty()) {
                    heroImg = wlist.get(0).optString("image", "");
                }
                final String fHero = abs(heroImg);

                runOnUiThread(() -> {
                    if (!sched.isEmpty()) homeSchedule.setText(sched);
                    if (!addr.isEmpty()) homeAddress.setText(addr);
                    netBanner.setVisibility(View.GONE);
                    svcList.removeAllViews();
                    renderServices();
                    renderContacts();
                    if (!fHero.isEmpty()) MiniImg.load(homePhoto, fHero);
                });

                JSONArray promos = o.optJSONArray("promos");
                if (promos != null) {
                    final List<JSONObject> plist = new ArrayList<>();
                    for (int i = 0; i < promos.length(); i++)
                        plist.add(promos.optJSONObject(i));
                    runOnUiThread(() -> renderPromos(plist));
                }

                runOnUiThread(() -> renderWorks(wlist));
            } catch (Exception ignored) {
            }
        }

        @android.webkit.JavascriptInterface
        public void closeLead() {
            runOnUiThread(() -> {
                if (bookingDialog != null) bookingDialog.dismiss();
            });
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
            card.setOnClickListener(v -> showSiteBooking());
            promosRow.addView(card);
        }
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics()));
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
    }
}
