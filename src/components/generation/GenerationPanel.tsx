import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ReplayIcon from "@mui/icons-material/Replay";
import {
  Box,
  Button,
  Collapse,
  Typography,
  keyframes,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import {
  StepData,
  StepStatus,
  useConversationStore,
} from "../../stores/conversationStore.ts";
import { PIPELINE_STEPS, PipelineStepKey } from "../../types/pipeline.ts";
import { AIStar } from "../icons/AiStar";
import { AIStarSpinner } from "../icons/AiStarSpinner";
import { CountdownTimer } from "./CountdownTimer.tsx";
import {
  EntitiesOutput,
  PhoneSelectionOutput,
  SocialGraphOutput,
  StoryOutput,
  TimelineOutput,
} from "./step-outputs";
import { StoryGenerationOutput } from "./step-outputs/StoryGenerationOutput.tsx";
import { SubmitJobOutput } from "./step-outputs/SubmitJobOutput.tsx";
import { ActionButton } from "../shared/styledComponents";

const PanelContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: theme.custom.gradients.panelGlow,
  overflow: "hidden",
}));

const ScrollContainer = styled(Box)({
  flex: 1,
  overflowY: "auto",
  padding: "32px",
});

const ContentWrapper = styled(Box)({
  display: "flex",
  flexDirection: "column",
  maxWidth: 900,
  margin: "0 auto",
  width: "100%",
});

const Header = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 32,
});

const IconWrapper = styled(Box)(({ theme }) => ({
  width: 56,
  height: 56,
  borderRadius: "50%",
  backgroundColor: theme.custom.surface.white8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const Title = styled(Typography)(({ theme }) => ({
  fontSize: "1.75rem",
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

const StepsContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  gap: 16,
});

const StepCard = styled(Box)<{ isActive: boolean }>(({ theme, isActive }) => ({
  backgroundColor: isActive
    ? theme.custom.surface.white8
    : theme.custom.surface.white5,
  borderRadius: 12,
  border: isActive
    ? `1px solid ${theme.custom.border.orange}`
    : `1px solid ${theme.custom.surface.white8}`,
  overflow: "hidden",
  transition: "all 0.2s ease",
}));

const StepHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "16px 20px",
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.custom.surface.white5,
  },
}));

const StepIcon = styled(Box)<{ status: StepStatus }>(({ theme, status }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color:
    status === "completed"
      ? theme.palette.success.main
      : status === "in-progress"
        ? theme.palette.secondary.main
        : status === "error"
          ? theme.palette.error.main
          : theme.custom.palette.text.hint,
}));

const StepInfo = styled(Box)({
  flex: 1,
});

const StepLabel = styled(Typography)<{ status: StepStatus }>(({ theme, status }) => ({
  fontSize: "1rem",
  fontWeight: status === "in-progress" ? 600 : 500,
  color:
    status === "completed"
      ? theme.palette.success.main
      : status === "in-progress"
        ? theme.palette.text.primary
        : status === "error"
          ? theme.palette.error.main
          : theme.custom.palette.text.placeholder,
}));

const StepDescription = styled(Typography)(({ theme }) => ({
  fontSize: "0.8rem",
  color: theme.palette.text.disabled,
  marginTop: 2,
}));

const StepContent = styled(Box)({
  padding: "0 20px 20px",
});

const TimerContainer = styled(Box)(({ theme }) => ({
  padding: "16px 32px 32px",
  borderTop: `1px solid ${theme.custom.border.default}`,
  backgroundColor: theme.custom.palette.background.overlay,
}));

const WaitingContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  padding: 48,
});

const WaitingMessage = styled(Typography)(({ theme }) => ({
  fontSize: "1.5rem",
  fontWeight: 500,
  color: theme.custom.palette.text.muted,
  textAlign: "center",
  marginTop: 24,
}));

const ContainerStyled = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  width: "32px",
  height: "32px",
  borderRadius: "50%",
}));

function getStepIcon(status: StepStatus) {
  switch (status) {
    case "completed":
      return <CheckCircleIcon />;

    case "in-progress":
      const spin2 = keyframes`
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      `;

      return (
        <ContainerStyled>
          <AIStar sx={{ position: "absolute", width: "24px", height: "24px" }} />
          <AIStarSpinner
            sx={{
              animation: `${spin2} 1500ms infinite`,
            }}
          />
        </ContainerStyled>
      );
    case "error":
      return <ErrorIcon />;
    case "editing":
      return <EditIcon />;
    default:
      return <RadioButtonUncheckedIcon />;
  }
}

function hasStepData(stepKey: PipelineStepKey, stepData: StepData): boolean {
  switch (stepKey) {
    case "story-expansion":
      return !!stepData.storyExpansion;
    case "entity-extraction":
      return !!stepData.entities && stepData.entities.length > 0;
    case "social-graph":
      return !!stepData.socialGraph;
    case "timeline":
      return !!stepData.timeline && stepData.timeline.length > 0;
    case "phone-selection":
      return !!stepData.selectedPhones && stepData.selectedPhones.length > 0;
    case "story-generation":
      return !!stepData.jobGenerationResult;
    case "submit-job":
      return !!stepData.submittedJobs && stepData.submittedJobs.length > 0;
    default:
      return false;
  }
}

export function GenerationPanel() {
  const {
    isGenerating,
    generationProgress,
    autoContinue,
    toggleStepExpanded,
    startEditing,
    editingStep,
    saveEdits,
    cancelEditing,
    continueToNextStep,
    retryStep,
  } = useConversationStore();

  const { steps, stepData, expandedSteps, currentStep } = generationProgress;

  const allStepsCompleted =
    Object.values(steps).filter((s) => s === "completed").length ===
    PIPELINE_STEPS.length;

  if (!isGenerating && !Object.values(steps).some((s) => s === "completed")) {
    return (
      <PanelContainer>
        <WaitingContainer>
          <IconWrapper>
            <AutoAwesomeIcon
              sx={(theme) => ({ fontSize: 32, color: theme.custom.palette.text.muted })}
            />
          </IconWrapper>
          <WaitingMessage>
            Start a conversation to begin generating your UFDR
          </WaitingMessage>
        </WaitingContainer>
      </PanelContainer>
    );
  }

  const renderStepOutput = (stepKey: PipelineStepKey) => {
    const isEditing = editingStep === stepKey;
    const isExpanded = expandedSteps[stepKey];

    switch (stepKey) {
      case "story-expansion":
        if (!stepData.storyExpansion) return null;
        return (
          <StoryOutput
            data={stepData.storyExpansion}
            isEditing={isEditing}
            isExpanded={isExpanded}
          />
        );
      case "entity-extraction":
        if (!stepData.entities) return null;
        return (
          <EntitiesOutput
            data={stepData.entities}
            isEditing={isEditing}
            isExpanded={isExpanded}
          />
        );
      case "social-graph":
        if (!stepData.socialGraph) return null;
        return (
          <SocialGraphOutput
            data={stepData.socialGraph}
            entities={stepData.entities}
            isEditing={isEditing}
            isExpanded={isExpanded}
          />
        );
      case "timeline":
        if (!stepData.timeline) return null;
        return (
          <TimelineOutput
            data={stepData.timeline}
            entities={stepData.entities}
            isEditing={isEditing}
            isExpanded={isExpanded}
          />
        );
      case "phone-selection":
        return (
          <PhoneSelectionOutput
            data={stepData.selectedPhones || []}
            entities={stepData.entities || []}
            isEditing={isEditing}
            isExpanded={isExpanded}
          />
        );
      case "story-generation":
        if (!stepData.jobGenerationResult) return null;
        return (
          <StoryGenerationOutput
            data={stepData.jobGenerationResult}
            isEditing={isEditing}
            isExpanded={isExpanded}
          />
        );
      case "submit-job":
        return (
          <SubmitJobOutput
            submittedJobs={stepData.submittedJobs}
            isSubmitted={stepData.jobSubmitted || false}
            isEditing={isEditing}
            isExpanded={isExpanded}
          />
        );
      default:
        return null;
    }
  };

  return (
    <PanelContainer>
      <ScrollContainer>
        <ContentWrapper>
          <Header>
            <IconWrapper>
              <AutoAwesomeIcon sx={(theme) => ({ fontSize: 28, color: theme.palette.secondary.main })} />
            </IconWrapper>
            <Box>
              <Title>Generating your UFDR</Title>
              <Typography
                sx={(theme) => ({ color: theme.custom.palette.text.placeholder, fontSize: "0.9rem" })}
              >
                Review and edit each step before continuing
              </Typography>
            </Box>
          </Header>

          <StepsContainer>
            {PIPELINE_STEPS.map((step) => {
              const status = steps[step.key];
              const isActive = currentStep === step.key;
              const hasData = hasStepData(step.key, stepData);
              const isExpanded = expandedSteps[step.key];

              return (
                <StepCard key={step.key} isActive={isActive}>
                  <StepHeader
                    onClick={() => hasData && toggleStepExpanded(step.key)}
                  >
                    <StepIcon status={status}>{getStepIcon(status)}</StepIcon>
                    <StepInfo>
                      <StepLabel status={status}>{step.label}</StepLabel>
                      <StepDescription>{step.description}</StepDescription>
                    </StepInfo>
                    {(hasData || status === "error") && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {editingStep === step.key ? (
                          <>
                            <ActionButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveEdits();
                              }}
                              sx={(theme) => ({ color: theme.palette.success.main })}
                            >
                              <CheckIcon fontSize="small" />
                            </ActionButton>
                            <ActionButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                              sx={(theme) => ({ color: theme.palette.error.main })}
                            >
                              <CloseIcon fontSize="small" />
                            </ActionButton>
                          </>
                        ) : (
                          <>
                            {status === "completed" && (
                              <ActionButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(step.key);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </ActionButton>
                            )}
                            {status === "error" && (
                              <ActionButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  retryStep(step.key);
                                }}
                                sx={(theme) => ({ color: theme.palette.secondary.main })}
                                title="Retry this step"
                              >
                                <ReplayIcon fontSize="small" />
                              </ActionButton>
                            )}
                          </>
                        )}
                        {hasData && (
                          <ActionButton size="small">
                            {isExpanded ? (
                              <ExpandLessIcon />
                            ) : (
                              <ExpandMoreIcon />
                            )}
                          </ActionButton>
                        )}
                      </Box>
                    )}
                  </StepHeader>

                  <Collapse in={hasData && isExpanded}>
                    <StepContent>{renderStepOutput(step.key)}</StepContent>
                  </Collapse>
                </StepCard>
              );
            })}
          </StepsContainer>
        </ContentWrapper>
      </ScrollContainer>

      {autoContinue.isActive && (
        <TimerContainer>
          <Box sx={{ maxWidth: 900, margin: "0 auto" }}>
            <CountdownTimer />
          </Box>
        </TimerContainer>
      )}

      {/* Show continue button when paused (timer not active but there's a completed step that can continue) */}
      {/* Don't show when pipeline is complete (phone-selection is the last step) */}
      {!autoContinue.isActive &&
        currentStep &&
        currentStep !== "phone-selection" &&
        steps[currentStep] === "completed" &&
        !allStepsCompleted && (
          <TimerContainer>
            <Box
              sx={{
                maxWidth: 900,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Typography
                sx={(theme) => ({ color: theme.custom.palette.text.muted, fontSize: "0.9rem" })}
              >
                {editingStep
                  ? "Editing paused auto-continue"
                  : "Auto-continue paused"}
              </Typography>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={() => continueToNextStep()}
                sx={(theme) => ({
                  backgroundColor: theme.palette.secondary.main,
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  textTransform: "none",
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  "&:hover": {
                    backgroundColor: theme.palette.secondary.dark,
                  },
                })}
              >
                Continue to Next Step
              </Button>
            </Box>
          </TimerContainer>
        )}
    </PanelContainer>
  );
}
