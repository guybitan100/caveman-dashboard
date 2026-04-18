import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { ThemeProvider, CssBaseline, CircularProgress, Box } from "@mui/material";
import theme from "./theme";
import { HomePage } from "./pages/HomePage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { AuthProvider, useAuth } from "./contexts";
import { useMetaFinderInit } from "./hooks";
import { useDeviceModelsStore } from "./stores/deviceModelsStore";
import { DownloadIndicator } from "./components/download/DownloadIndicator.tsx";
import { UfdrRuntimePage } from "./components/ufdr-runtime";

export type AppView = "generate" | "runtime";

interface ViewContextValue {
  view: AppView;
  setView: (view: AppView) => void;
}

const ViewContext = createContext<ViewContextValue>({
  view: "generate",
  setView: () => {},
});

export function useAppView() {
  return useContext(ViewContext);
}

function AppContent() {
  const { user, isLoading: authLoading } = useAuth();
  const initializeDeviceModels = useDeviceModelsStore((state) => state.initialize);
  const [view, setView] = useState<AppView>("generate");

  useMetaFinderInit();

  useEffect(() => {
    if (user) {
      initializeDeviceModels();
    }
  }, [user, initializeDeviceModels]);

  const handleSetView = useCallback((v: AppView) => setView(v), []);

  if (authLoading) {
    return (
      <Box
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: theme.palette.background.default,
        })}
      >
        <CircularProgress sx={(theme) => ({ color: theme.palette.primary.light })} />
      </Box>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <ViewContext.Provider value={{ view, setView: handleSetView }}>
      {view === "runtime" ? <UfdrRuntimePage /> : <HomePage />}
      <DownloadIndicator />
    </ViewContext.Provider>
  );
}

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
