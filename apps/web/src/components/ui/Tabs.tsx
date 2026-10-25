"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx.ts";
import { nextTabIndex } from "./tabs-keys.ts";
import { tabClass, tabListClass } from "./classes.ts";

export type UseTabsOptions = {
  count: number;
  /** 制御するとき */
  selectedIndex?: number;
  defaultSelectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  /** auto = 矢印で移動したら即選択（既定、DADS useTabAria と同じ）、manual = Enter/Space で選択 */
  activation?: "auto" | "manual";
  orientation?: "horizontal" | "vertical";
};

/**
 * WAI-ARIA Tabs（DADS `useTabAria`）。tablist / tab / tabpanel の属性と、ロービング tabindex・矢印キーを返す。
 * パネルを 1 つだけ持つ使い方（エディタのファイルタブで Monaco を共有する等）でも使えるよう、
 * 見た目とは切り離したフックにしてある。
 */
export function useTabs({ count, selectedIndex, defaultSelectedIndex = 0, onSelectedIndexChange, activation = "auto", orientation = "horizontal" }: UseTabsOptions) {
  const [inner, setInner] = useState(defaultSelectedIndex);
  const selected = selectedIndex ?? inner;
  const idBase = useId();
  const tabRefs = useRef<Array<HTMLElement | null>>([]);

  const select = (i: number) => {
    if (selectedIndex === undefined) setInner(i);
    onSelectedIndexChange?.(i);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, index: number) => {
    const to = nextTabIndex(e.key, index, count, orientation);
    if (to !== null) {
      e.preventDefault();
      tabRefs.current[to]?.focus();
      if (activation === "auto") select(to);
      return;
    }
    if (activation === "manual" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      select(index);
    }
  };

  return {
    selectedIndex: selected,
    select,
    getListProps: (label: string) => ({
      role: "tablist" as const,
      "aria-label": label,
      "aria-orientation": orientation,
    }),
    getTabProps: (index: number) => ({
      ref: (el: HTMLElement | null) => {
        tabRefs.current[index] = el;
      },
      id: `${idBase}-tab-${index}`,
      role: "tab" as const,
      type: "button" as const,
      "aria-selected": index === selected,
      "aria-controls": `${idBase}-panel-${index}`,
      tabIndex: index === selected ? 0 : -1,
      onClick: () => select(index),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKeyDown(e, index),
    }),
    getPanelProps: (index: number) => ({
      id: `${idBase}-panel-${index}`,
      role: "tabpanel" as const,
      "aria-labelledby": `${idBase}-tab-${index}`,
      tabIndex: 0,
      hidden: index !== selected,
    }),
  };
}

export type TabItem = { id: string; label: ReactNode; panel: ReactNode };

export type TabsProps = {
  /** tablist の aria-label（例「ファイル」「表示」） */
  label: string;
  items: TabItem[];
  selectedId?: string;
  defaultSelectedId?: string;
  onSelectedIdChange?: (id: string) => void;
  /** タブ名を等幅にする（ファイル名タブ） */
  mono?: boolean;
  className?: string;
  panelClassName?: string;
};

/** よくある形（タブ＋パネル）の組み立て済み版。特殊な配置は useTabs を直接使う */
export function Tabs({ label, items, selectedId, defaultSelectedId, onSelectedIdChange, mono, className, panelClassName }: TabsProps) {
  const indexOf = (id: string | undefined) => Math.max(0, items.findIndex((t) => t.id === id));
  const tabs = useTabs({
    count: items.length,
    selectedIndex: selectedId === undefined ? undefined : indexOf(selectedId),
    defaultSelectedIndex: indexOf(defaultSelectedId),
    onSelectedIndexChange: (i) => onSelectedIdChange?.(items[i]!.id),
  });
  return (
    <div className={className}>
      <div {...tabs.getListProps(label)} className={tabListClass}>
        {items.map((t, i) => (
          <button key={t.id} {...tabs.getTabProps(i)} className={cx(tabClass, mono ? "text-mono-13N-150" : "text-dns-14N-130")}>
            {t.label}
          </button>
        ))}
      </div>
      {items.map((t, i) => (
        <div key={t.id} {...tabs.getPanelProps(i)} className={cx("focus-ring-inset", panelClassName)}>
          {t.panel}
        </div>
      ))}
    </div>
  );
}
