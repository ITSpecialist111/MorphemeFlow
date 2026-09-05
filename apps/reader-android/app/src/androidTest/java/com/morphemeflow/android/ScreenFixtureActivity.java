package com.morphemeflow.android;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;

public class ScreenFixtureActivity extends Activity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        if (getIntent().getBooleanExtra("secure", false)) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        TextView text = new TextView(this);
        text.setText("Reading independently");
        text.setTextSize(32);
        text.setTextColor(Color.BLACK);
        text.setGravity(Gravity.CENTER);
        root.addView(text, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));
        root.post(() -> text.setY(root.getHeight() * 0.45f - text.getHeight() / 2f));
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText("Clicks: 0");
        button.setOnClickListener(view -> button.setText("Clicks: 1"));
        float density = getResources().getDisplayMetrics().density;
        FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, (int) (64 * density), Gravity.BOTTOM);
        layout.bottomMargin = (int) (80 * density);
        root.addView(button, layout);
        setContentView(root);
    }
}