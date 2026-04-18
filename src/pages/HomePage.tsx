import { Background } from "@/components/icons/Background";
import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useCallback, useEffect, useState } from "react";
import { GenerateInput } from "../components/home";
import { AppLayout, SplitScreenLayout } from "../components/layout";
import { useConversationStore } from "../stores";
import { Animation } from "./Animation";

const LandingContent = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(0, 3, 6),
  background: "transparent",
  position: "relative",
  zIndex: 2,
  height: "100%",
}));

const BackgroundContainer = styled(Box)({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 0,
});

const ContentWrapper = styled(Box)({
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
  width: "100%",
  height: "100%",
});

const Title = styled(Typography)(({ theme }) => ({
  fontSize: "2.5rem",
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(4),
  textAlign: "center",
  [theme.breakpoints.down("md")]: {
    fontSize: "2rem",
  },
}));

export function HomePage() {
  const [inputValue, setInputValue] = useState("");
  const [hasStartedPipeline, setHasStartedPipeline] = useState(false);
  const { isConversationStarted, startConversation, runPipeline } =
    useConversationStore();

  const handleGenerate = useCallback(() => {
    if (!inputValue.trim()) return;
    startConversation(inputValue.trim());
    setInputValue("");
    setHasStartedPipeline(true);
  }, [inputValue, startConversation]);

  // Start the pipeline after conversation is started
  useEffect(() => {
    if (isConversationStarted && hasStartedPipeline) {
      runPipeline();
      setHasStartedPipeline(false);
    }
  }, [isConversationStarted, hasStartedPipeline, runPipeline]);

  // Render the content based on conversation state
  const renderContent = () => {
    if (isConversationStarted) {
      return <SplitScreenLayout />;
    }

    // Initial landing content with centered input
    return (
      <ContentWrapper>
        <BackgroundContainer>
          <Background />
          <Animation />
        </BackgroundContainer>
        <LandingContent>
          <Title variant="h1">Let's generate a UFDR 🚀</Title>
          <GenerateInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleGenerate}
          />
        </LandingContent>
      </ContentWrapper>
    );
  };

  return <AppLayout>{renderContent()}</AppLayout>;
}
