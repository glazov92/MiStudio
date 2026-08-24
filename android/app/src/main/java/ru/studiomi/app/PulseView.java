package ru.studiomi.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Handler;
import android.os.Looper;
import android.util.AttributeSet;
import android.view.View;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

public class PulseView extends View {

    private static final long PERIOD_MS = 5000; // волны раз в 5 секунд
    private static final long BURST_STAGGER_MS = 350;
    private static final long RING_DURATION_MS = 1600;
    private static final int RINGS_PER_BURST = 3;

    private static class Ring {
        final long startedAt = System.currentTimeMillis();
        Ring() {
        }
    }

    private final List<Ring> rings = new ArrayList<>();
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable tick = this::invalidateRings;
    private final Runnable burst = this::burstNow;
    private final Runnable periodic = new Runnable() {
        @Override
        public void run() {
            burstNow();
            handler.postDelayed(this, PERIOD_MS);
        }
    };

    public PulseView(Context context) {
        super(context);
        init();
    }

    public PulseView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    public PulseView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    private void init() {
        paint.setStyle(Paint.Style.STROKE);
        paint.setColor(Color.parseColor("#B8975A"));
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        handler.post(burst);                 // первый «пшик» сразу
        handler.postDelayed(periodic, PERIOD_MS);
    }

    @Override
    protected void onDetachedFromWindow() {
        handler.removeCallbacksAndMessages(null);
        rings.clear();
        super.onDetachedFromWindow();
    }

    private void burstNow() {
        for (int i = 0; i < RINGS_PER_BURST; i++) {
            handler.postDelayed(() -> {
                rings.add(new Ring());
                startTicking();
            }, i * BURST_STAGGER_MS);
        }
    }

    private void startTicking() {
        if (rings.size() == 1) {
            handler.post(tick);
        }
    }

    private void invalidateRings() {
        invalidate();
        if (!rings.isEmpty()) {
            postInvalidateOnAnimation();
            handler.postDelayed(tick, 16);
        }
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (rings.isEmpty()) return;
        float maxR = Math.min(getWidth(), getHeight()) / 2f - 2f;
        long now = System.currentTimeMillis();
        Iterator<Ring> it = rings.iterator();
        while (it.hasNext()) {
            float f = (now - it.next().startedAt) / (float) RING_DURATION_MS;
            if (f >= 1f) {
                it.remove();
                continue;
            }
            paint.setAlpha((int) ((1f - f) * 130));
            paint.setStrokeWidth(3f + (1f - f) * 4f);
            canvas.drawCircle(getWidth() / 2f, getHeight() / 2f, 34f + f * (maxR - 34f), paint);
        }
    }
}
