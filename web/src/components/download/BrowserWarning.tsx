import {
    Box,
    Typography,
    Link,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
    NarrowDialog,
    DialogHeader,
    HeaderContent,
    HeaderTitle,
    CloseButton,
    StyledDialogActions,
    FormSectionPadded,
    PrimaryButton,
    SecondaryButton,
} from "../shared/styledComponents";

const WarningIcon = styled(Box)(({ theme }) => ({
    width: 36,
    height: 36,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.custom.status.warning.light,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.custom.status.warning.main,
}));

interface BrowserWarningProps {
    open: boolean;
    onClose: () => void;
}

export function BrowserWarning({ open, onClose }: BrowserWarningProps) {
    return (
        <NarrowDialog open={open} onClose={onClose} maxWidth="sm">
            <DialogHeader>
                <HeaderContent>
                    <WarningIcon>
                        <WarningAmberIcon />
                    </WarningIcon>
                    <HeaderTitle>Browser Not Supported</HeaderTitle>
                </HeaderContent>
                <CloseButton onClick={onClose} aria-label="Close">
                    <CloseIcon />
                </CloseButton>
            </DialogHeader>

            <FormSectionPadded>
                <Typography variant="body1" gutterBottom>
                    Downloading large files requires Chrome or Microsoft Edge.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Your current browser doesn't support the File System Access API needed
                    for reliable large file downloads. Please use Chrome or Edge to
                    download UFDR files.
                </Typography>
            </FormSectionPadded>

            <StyledDialogActions>
                <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                <Link
                    href="https://www.google.com/chrome/"
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="none"
                >
                    <PrimaryButton>
                        Get Chrome
                    </PrimaryButton>
                </Link>
            </StyledDialogActions>
        </NarrowDialog>
    );
}
