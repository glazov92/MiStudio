package ru.studiomi.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.widget.ImageView;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;

public final class MiniImg {

    private static final Map<String, Bitmap> CACHE = new ConcurrentHashMap<>();
    private static final ExecutorService EX = Executors.newFixedThreadPool(3);
    private static final int MAX_DIM = 1100;

    private MiniImg() {
    }

    public static void load(ImageView iv, String url) {
        if (url == null || url.isEmpty()) return;
        iv.setTag(url);
        Bitmap cached = CACHE.get(url);
        if (cached != null) {
            iv.setImageBitmap(cached);
            return;
        }
        iv.setImageResource(R.drawable.bg_img_ph);
        iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
        EX.execute(() -> {
            Bitmap cached2 = CACHE.get(url);
            final Bitmap b;
            if (cached2 != null) {
                b = cached2;
            } else {
                Bitmap fetched = fetch(url);
                if (fetched == null) return;
                CACHE.put(url, fetched);
                b = fetched;
            }
            iv.post(() -> {
                if (url.equals(iv.getTag())) iv.setImageBitmap(b);
            });
        });
    }

    private static Bitmap fetch(String url) {
        try {
            if (url.startsWith("data:")) {
                int comma = url.indexOf(',');
                if (comma < 0) return null;
                byte[] bytes = Base64.decode(url.substring(comma + 1), Base64.DEFAULT);
                return decode(bytes);
            }
            HttpURLConnection c = (HttpURLConnection) new java.net.URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            try (InputStream is = c.getInputStream()) {
                byte[] bytes = readAll(is);
                return decode(bytes);
            } finally {
                c.disconnect();
            }
        } catch (Exception e) {
            return null;
        }
    }

    private static byte[] readAll(InputStream is) throws Exception {
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toByteArray();
    }

    private static Bitmap decode(byte[] bytes) {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o);
        int sample = 1;
        while ((o.outWidth / sample) > MAX_DIM * 2 || (o.outHeight / sample) > MAX_DIM * 2) {
            sample *= 2;
        }
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = sample;
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o2);
    }
}
