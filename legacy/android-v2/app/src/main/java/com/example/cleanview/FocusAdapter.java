package com.example.cleanview;

import android.graphics.Color;
import android.graphics.Typeface;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

public class FocusAdapter extends RecyclerView.Adapter<FocusAdapter.FocusViewHolder> {

    public interface OnItemSelectedListener {
        void onItemSelected(FocusItem item);
    }

    private final List<FocusItem>        items    = new ArrayList<>();
    private final OnItemSelectedListener listener;
    private       int                    activeIndex = -1;

    public FocusAdapter(List<FocusItem> initial, OnItemSelectedListener listener) {
        this.listener = listener;
        if (initial != null) items.addAll(initial);
    }

    // ── Data updates ──────────────────────────────────────────────

    public void updateItems(List<FocusItem> newItems) {
        items.clear();
        if (newItems != null) items.addAll(newItems);
        activeIndex = -1;
        notifyDataSetChanged();
    }

    /**
     * Moves the active highlight to a new position.
     * FIX H: Only rebinds the two rows that actually changed
     * (old active → new active) instead of the entire list,
     * eliminating the full-list flash on every highlight change.
     */
    public void setActiveIndex(int newIndex) {
        int old = activeIndex;
        activeIndex = newIndex;
        if (old >= 0 && old < items.size()) notifyItemChanged(old);
        if (newIndex >= 0 && newIndex < items.size()) notifyItemChanged(newIndex);
    }

    public FocusItem getItem(int position) {
        return items.get(position);
    }

    /**
     * Returns the position of an item by reference.
     * Used by MainActivity to find which index was tapped.
     */
    public int indexOf(FocusItem item) {
        return items.indexOf(item);
    }

    // ── RecyclerView.Adapter ──────────────────────────────────────

    @NonNull
    @Override
    public FocusViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View v = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_focus, parent, false);
        return new FocusViewHolder(v);
    }

    @Override
    public void onBindViewHolder(@NonNull FocusViewHolder holder, int position) {
        FocusItem item = items.get(position);
        holder.tvContent.setText(item.getText());

        if (item.getType() == FocusItem.Type.HEADING_1) {
            // HEADING: large cyan bold text with cyan accent bar
            holder.tvContent.setTextColor(Color.CYAN);
            holder.tvContent.setTextSize(28f);
            holder.tvContent.setTypeface(null, Typeface.BOLD);
            holder.accentBar.setBackgroundColor(Color.CYAN);
            holder.itemView.setPadding(20, 60, 20, 20);
        } else {
            // PARAGRAPH: readable white text, no accent bar
            holder.tvContent.setTextColor(Color.WHITE);
            holder.tvContent.setTextSize(20f);
            holder.tvContent.setTypeface(null, Typeface.NORMAL);
            holder.accentBar.setBackgroundColor(Color.TRANSPARENT);
            holder.itemView.setPadding(20, 20, 20, 40);
        }

        // Active row gets a subtle background highlight so the user
        // can visually track which item is being read
        holder.itemView.setBackgroundColor(
                position == activeIndex
                        ? Color.parseColor("#1A1A1A")
                        : Color.BLACK);

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) listener.onItemSelected(item);
        });
    }

    @Override
    public int getItemCount() { return items.size(); }

    // ── ViewHolder ────────────────────────────────────────────────

    static class FocusViewHolder extends RecyclerView.ViewHolder {
        final TextView tvContent;
        final View     accentBar;

        FocusViewHolder(@NonNull View v) {
            super(v);
            tvContent = v.findViewById(R.id.tvContent);
            accentBar = v.findViewById(R.id.accentBar);
        }
    }
}

// ── FocusItem data model ──────────────────────────────────────────
class FocusItem {
    public enum Type { HEADING_1, HEADING_2, PARAGRAPH, LINK }

    private final Type   type;
    private final String text;
    private final String href;

    public FocusItem(Type type, String text, String href) {
        this.type = type;
        this.text = text != null ? text : "";
        this.href = href != null ? href : "";
    }

    public Type   getType() { return type; }
    public String getText() { return text; }
    public String getHref() { return href; }
}
