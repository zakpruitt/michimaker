/**
 * Application shell: wires the providers together and lays out the screen:
 * header with toolbar, the binder spreads on the left, and the tabbed
 * Cards / Art side panel on the right.
 *
 * Touch-only devices (phones, tablets) get a feature-showcase landing page
 * instead: the planner's drag-selection needs a desktop browser and a mouse.
 */
import { useState } from "react";
import { NoticeProvider } from "./components/notices/NoticeContext";
import { NoticeList } from "./components/notices/NoticeList";
import { BinderProvider } from "./features/binder/BinderContext";
import { PrintProvider } from "./features/print/PrintContext";
import { BinderSpreadList } from "./features/binder/BinderSpreadList";
import { SelectionBanner } from "./features/binder/SelectionBanner";
import { CardSearchPanel } from "./features/card-search/CardSearchPanel";
import { ArtPanel } from "./features/art-gallery/ArtPanel";
import { MobileLandingPage } from "./features/landing/MobileLandingPage";
import { useIsDesktop } from "./features/landing/useIsDesktop";
import { HowToPage } from "./features/how-to/HowToPage";
import { HOW_TO_HASH, useHashRoute } from "./features/how-to/useHashRoute";
import { BinderToolbar } from "./features/sharing/BinderToolbar";
import styles from "./App.module.css";

type SidePanelTab = "cards" | "art";

export default function App() {
  const isDesktop = useIsDesktop();
  const route = useHashRoute();

  // The guide is plain reading, so it works on any device.
  if (route === HOW_TO_HASH) {
    return <HowToPage />;
  }

  if (!isDesktop) {
    return <MobileLandingPage />;
  }

  return (
    <NoticeProvider>
      <BinderProvider>
        <PrintProvider>
          <AppLayout />
          <NoticeList />
        </PrintProvider>
      </BinderProvider>
    </NoticeProvider>
  );
}

function AppLayout() {
  const [activeTab, setActiveTab] = useState<SidePanelTab>("cards");

  return (
    <div className={styles.appContainer}>
      <header className={styles.header} data-print="hide">
        <div className={styles.branding}>
          <h1 className={styles.title}>MichiMaker</h1>
          <p className={styles.subtitle}>
            Plan 9-pocket binder pages and Michi-method art spreads
          </p>
        </div>
        <BinderToolbar />
      </header>

      <main className={styles.mainLayout}>
        <div className={styles.binderColumn}>
          <SelectionBanner />
          <div className={styles.scrollArea} data-print="scroll-area">
            <BinderSpreadList />
          </div>
        </div>

        <aside className={styles.sidePanel} data-print="hide">
          <div className={styles.tabBar} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "cards"}
              className={activeTab === "cards" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("cards")}
            >
              Cards
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "art"}
              className={activeTab === "art" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("art")}
            >
              Art
            </button>
          </div>
          <div className={styles.tabContent}>
            {activeTab === "cards" ? <CardSearchPanel /> : <ArtPanel />}
          </div>
        </aside>
      </main>
    </div>
  );
}
