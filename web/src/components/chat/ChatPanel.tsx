import { useState, useRef, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { Box, Typography, TextField } from '@mui/material';
import { useConversationStore, Message } from '../../stores/conversationStore.ts';
import { PIPELINE_STEPS } from '../../types/pipeline.ts';
import titanLogo from '../../assets/titan-logo.svg';
import { GoButton } from '../shared/GoButton.tsx';

const PanelContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.custom.palette.background.elevated,
    borderRight: `1px solid ${theme.custom.border.default}`,
}));

const Header = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.custom.border.default}`,
}));

const HeaderTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1.25rem',
    fontWeight: 700,
    color: theme.palette.text.primary,
}));

const MessagesContainer = styled(Box)({
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
});

const MessageRow = styled(Box)<{ isUser: boolean }>(({ isUser }) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    flexDirection: isUser ? 'row-reverse' : 'row',
    maxWidth: '90%',
}));

const Avatar = styled(Box)(({ theme }) => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    backgroundColor: theme.custom.surface.white8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
}));

const AvatarImage = styled('img')({
    width: 16,
    height: 'auto',
    padding: 2,
});

const MessageBubble = styled(Box)<{ isUser: boolean }>(({ theme, isUser }) => ({
    padding: '12px 16px',
    borderRadius: 12,
    backgroundColor: isUser ? theme.custom.surface.white8 : theme.custom.surface.white5,
    color: theme.palette.text.secondary,
    fontSize: '0.9rem',
    lineHeight: 1.6,
}));

const InputContainer = styled(Box)(({ theme }) => ({
    padding: '16px 20px',
    borderTop: `1px solid ${theme.custom.border.default}`,
}));

const InputWrapper = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    backgroundColor: theme.custom.surface.white5,
    borderRadius: 12,
    padding: '12px 16px',
    border: `1px solid ${theme.custom.border.default}`,
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        padding: 0,
        backgroundColor: 'transparent',
        color: theme.palette.text.primary,
        fontSize: '0.9rem',
        '& fieldset': {
            border: 'none',
        },
    },
    '& .MuiInputBase-input::placeholder': {
        color: theme.palette.text.disabled,
        opacity: 1,
    },
}));

const InputActions = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
});

const StepContextBadge = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    backgroundColor: theme.custom.surface.orange10,
    borderRadius: 6,
    border: `1px solid ${theme.custom.surface.orange20}`,
    fontSize: '0.7rem',
    color: theme.palette.secondary.main,
    fontWeight: 500,
}));


export function ChatPanel() {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const {
        messages,
        isLoading,
        addMessage,
        setLoading,
        runPipeline,
        isGenerating,
        generationProgress,
        stopAutoContinue,
    } = useConversationStore();

    const currentStep = generationProgress.currentStep;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const getPlaceholder = (): string => {
        if (isGenerating && currentStep) {
            const stepConfig = PIPELINE_STEPS.find(s => s.key === currentStep);
            return `Add instructions for ${stepConfig?.label || currentStep}...`;
        }
        return "Describe the story for your UFDR...";
    };

    const handleSubmit = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage = inputValue.trim();
        setInputValue('');

        // Add user message
        addMessage({ role: 'user', content: userMessage });

        // If generation is in progress, this is a refinement instruction
        if (isGenerating && currentStep) {
            // Stop auto-continue when user provides input
            stopAutoContinue();

            addMessage({
                role: 'assistant',
                content: `I'll incorporate your feedback into the ${PIPELINE_STEPS.find(s => s.key === currentStep)?.label || currentStep} step. Please wait...`,
            });

            // TODO: Regenerate current step with user's instructions
            return;
        }

        // Start the pipeline with the initial prompt
        setLoading(true);
        addMessage({
            role: 'assistant',
            content: 'Starting UFDR generation pipeline...',
        });
        setLoading(false);

        // Run the pipeline
        await runPipeline();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <PanelContainer>
            <Header>
                <HeaderTitle>Chat</HeaderTitle>
                {isGenerating && currentStep && (
                    <StepContextBadge>
                        {PIPELINE_STEPS.find(s => s.key === currentStep)?.label || currentStep}
                    </StepContextBadge>
                )}
            </Header>

            <MessagesContainer>
                {messages.map((message: Message) => (
                    <MessageRow key={message.id} isUser={message.role === 'user'}>
                        {message.role === 'assistant' && (
                            <Avatar>
                                <AvatarImage src={titanLogo} alt="Titan" />
                            </Avatar>
                        )}
                        <MessageBubble isUser={message.role === 'user'}>
                            {message.content}
                        </MessageBubble>
                    </MessageRow>
                ))}
                {isLoading && (
                    <MessageRow isUser={false}>
                        <Avatar>
                            <AvatarImage src={titanLogo} alt="Titan" />
                        </Avatar>
                        <MessageBubble isUser={false}>
                            <Typography sx={(theme) => ({ color: theme.custom.palette.text.muted, fontStyle: 'italic' })}>
                                Thinking...
                            </Typography>
                        </MessageBubble>
                    </MessageRow>
                )}
                <div ref={messagesEndRef} />
            </MessagesContainer>

            <InputContainer>
                <InputWrapper>
                    <StyledTextField
                        fullWidth
                        multiline
                        maxRows={4}
                        placeholder={getPlaceholder()}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                    />
                    <InputActions>
                        <Box />
                        <GoButton
                            size="small"
                            onClick={handleSubmit}
                            disabled={!inputValue.trim() || isLoading}
                        />
                    </InputActions>
                </InputWrapper>
            </InputContainer>
        </PanelContainer>
    );
}
