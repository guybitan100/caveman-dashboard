import { useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Alert,
  LinearProgress,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import BuildIcon from "@mui/icons-material/Build";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import TerminalIcon from "@mui/icons-material/Terminal";
import { useUfdrRuntimeStore } from "../../stores/ufdrRuntimeStore.ts";
import type { TabId } from "../../types/ufdrRuntime.ts";
import { RUNTIME_STATUS_LABELS } from "../../types/ufdrRuntime.ts";
import {
  formatDuration,
  describeSourceSummary,
} from "../../utils/ufdrRuntime.ts";
import { BuilderTab } from "./BuilderTab.tsx";
import { LaunchTab } from "./LaunchTab.tsx";
import { SummaryTab } from "./SummaryTab.tsx";
import { InventoryTab } from "./InventoryTab.tsx";
import { ConsolePanel } from "./ConsolePanel.tsx";
import { HomeHeader } from "../home/HomeHeader.tsx";

const PageShell = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  width: "100%",
  background: theme.custom.gradients.pageBackground,
  overflow: "hidden",
}));

const Header = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.custom.border.default}`,
  background: "rgba(10, 22, 38, 0.5)",
  backdropFilter: "blur(12px)",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
}));

const HeaderBrand = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

const BrandAvatar = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
  color: theme.palette.primary.contrastText,
  fontWeight: 800,
  fontSize: "0.85rem",
}));

const CapsuleGroup = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  flexWrap: "wrap",
}));

const CapsuleCard = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(0.5, 1.5),
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${theme.custom.border.default}`,
  minWidth: 64,
}));

const MiniBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== "percent",
})<{ percent: number }>(({ percent }) => ({
  height: 3,
  borderRadius: 2,
  background: "rgba(255,255,255,0.08)",
  marginTop: 4,
  overflow: "hidden",
  "&::after": {
    content: '""',
    display: "block",
    height: "100%",
    width: `${Math.min(100, percent)}%`,
    borderRadius: 2,
    background:
      percent > 85
        ? "#ff8092"
        : percent > 65
          ? "#f7c65f"
          : "#22d3ee",
    transition: "width 0.3s ease",
  },
}));

const MainCard = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  margin: theme.spacing(1.5),
  borderRadius: 20,
  border: `1px solid ${theme.custom.border.default}`,
  background:
    "linear-gradient(180deg, rgba(14, 35, 54, 0.52), rgba(8, 18, 30, 0.34))",
  backdropFilter: "blur(18px)",
}));

const TabBody = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: "auto",
  padding: theme.spacing(3),
  "&::-webkit-scrollbar": { width: 6 },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(255,255,255,0.12)",
    borderRadius: 3,
  },
}));

const TAB_MAP: { id: TabId; label: string; icon: typeof BuildIcon }[] = [
  { id: "builder", label: "Builder", icon: BuildIcon },
  { id: "launch", label: "Launch", icon: RocketLaunchIcon },
  { id: "summary", label: "Summary", icon: DescriptionIcon },
  { id: "inventory", label: "Inventory", icon: FolderIcon },
  { id: "logs", label: "Logs", icon: TerminalIcon },
];

const statusColors: Record<string, string> = {
  idle: "#9db2ca",
  running: "#22d3ee",
  completed: "#4ade80",
  failed: "#ff6b7a",
  cancelled: "#f7c65f",
};

export function UfdrRuntimePage() {
  const {
    form,
    localFiles,
    job,
    systemStats,
    summaryOutput,
    summaryCommand,
    busyAction,
    formError,
    inventoryError,
    pageError,
    activeTab,
    consoleVisible,
    consolePoppedOut,
    updateField,
    setActiveTab,
    toggleConsole,
    togglePopout,
    loadAppBoot,
    loadLocalFiles,
    loadJobStatus,
    loadSystemStats,
    handlePreviewSummary,
    handlePrimaryAction,
    handleCancelRun,
    getIsRunning,
    getCanSubmit,
    getSelectedFileDetails,
  } = useUfdrRuntimeStore();

  const isRunning = getIsRunning();
  const canSubmit = getCanSubmit();
  const selectedFileDetails = getSelectedFileDetails();

  // Boot
  useEffect(() => {
    loadAppBoot();
  }, [loadAppBoot]);

  // Polling when running
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      loadJobStatus();
      loadSystemStats();
    }, 1500);
    return () => window.clearInterval(id);
  }, [isRunning, loadJobStatus, loadSystemStats]);

  // System stats polling
  useEffect(() => {
    const id = window.setInterval(() => loadSystemStats(), 10000);
    return () => window.clearInterval(id);
  }, [loadSystemStats]);

  const statusLabel =
    job.cancellationRequested && job.status === "running"
      ? "Stopping"
      : RUNTIME_STATUS_LABELS[job.status] ?? job.status;

  const sourceSummary = useMemo(
    () => describeSourceSummary(form, selectedFileDetails),
    [form, selectedFileDetails]
  );

  const tabIndex = TAB_MAP.findIndex((t) => t.id === activeTab);

  const handleTabChange = useCallback(
    (_: unknown, newValue: number) => {
      setActiveTab(TAB_MAP[newValue].id);
    },
    [setActiveTab]
  );

  return (
    <PageShell>
      <HomeHeader />
      {/* ─── Header ─── */}
      <Header>
        <HeaderBrand>
          <BrandAvatar>U</BrandAvatar>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", lineHeight: 1 }}
            >
              UFDR workspace
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              UFDR Creation
            </Typography>
          </Box>
        </HeaderBrand>

        <CapsuleGroup>
          <CapsuleCard>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
              Status
            </Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ color: statusColors[job.status] }}
            >
              {statusLabel}
            </Typography>
          </CapsuleCard>
          <CapsuleCard>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
              UFDRs
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              {localFiles.length}
            </Typography>
          </CapsuleCard>
          <CapsuleCard>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
              Host
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {systemStats?.hostname ?? "--"}
            </Typography>
          </CapsuleCard>
          <CapsuleCard>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
              Mem
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {systemStats
                ? `${Math.round(systemStats.memoryUsedPercent)}%`
                : "--"}
            </Typography>
            <MiniBar percent={systemStats?.memoryUsedPercent ?? 0} />
          </CapsuleCard>
          <CapsuleCard>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
              Load
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {systemStats?.loadAverage?.[0]?.toFixed(2) ?? "--"}
            </Typography>
          </CapsuleCard>
          <CapsuleCard>
            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
              Uptime
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatDuration(systemStats?.uptimeSeconds)}
            </Typography>
          </CapsuleCard>
        </CapsuleGroup>
      </Header>

      {/* Errors */}
      {pageError && (
        <Alert severity="error" sx={{ mx: 1.5, mt: 1 }}>
          {pageError}
        </Alert>
      )}
      {formError && (
        <Alert severity="warning" sx={{ mx: 1.5, mt: 1 }}>
          {formError}
        </Alert>
      )}

      {/* ─── Main card with tabs ─── */}
      <MainCard>
        <Tabs
          value={tabIndex >= 0 ? tabIndex : 0}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            px: 2,
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              minHeight: 48,
            },
          }}
        >
          {TAB_MAP.map((tab) => (
            <Tab
              key={tab.id}
              icon={<tab.icon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={
                tab.id === "inventory"
                  ? `Inventory (${localFiles.length})`
                  : tab.id === "logs" && job.logs.length > 0
                    ? `Logs (${job.logs.length})`
                    : tab.label
              }
            />
          ))}
        </Tabs>

        {isRunning && (
          <LinearProgress
            sx={{
              height: 2,
              "& .MuiLinearProgress-bar": {
                background:
                  "linear-gradient(90deg, #22d3ee, #6dbfff, #22d3ee)",
              },
            }}
          />
        )}

        <TabBody>
          {activeTab === "builder" && (
            <BuilderTab
              form={form}
              localFiles={localFiles}
              onUpdateField={updateField}
              onRefreshSources={loadLocalFiles}
              sourceSummary={sourceSummary}
            />
          )}

          {activeTab === "launch" && (
            <LaunchTab
              job={job}
              form={form}
              selectedFileDetails={selectedFileDetails}
              isRunning={isRunning}
              canSubmit={canSubmit}
              busyAction={busyAction}
              consoleVisible={consoleVisible}
              consolePoppedOut={consolePoppedOut}
              onPrimaryAction={handlePrimaryAction}
              onPreviewSummary={handlePreviewSummary}
              onCancelRun={handleCancelRun}
              onToggleConsole={toggleConsole}
              onTogglePopout={togglePopout}
            />
          )}

          {activeTab === "summary" && (
            <SummaryTab
              summaryOutput={summaryOutput}
              summaryCommand={summaryCommand}
            />
          )}

          {activeTab === "inventory" && (
            <InventoryTab
              localFiles={localFiles}
              selectedLocalFile={form.selectedLocalFile}
              inventoryError={inventoryError}
              onSelectFile={(path) => updateField("selectedLocalFile", path)}
              onUpdateField={updateField}
            />
          )}

          {activeTab === "logs" && (
            <ConsolePanel
              lines={job.logs}
              visible
              poppedOut={consolePoppedOut}
              onToggle={() =>
                setActiveTab("launch")
              }
              onPopout={togglePopout}
            />
          )}
        </TabBody>
      </MainCard>
    </PageShell>
  );
}
