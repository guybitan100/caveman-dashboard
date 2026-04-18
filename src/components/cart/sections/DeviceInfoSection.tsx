import { useState } from "react";
import {
    Box,
    Typography,
    IconButton,
    CircularProgress,
    Collapse,
    Autocomplete,
    TextField,
    Divider,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import AppleIcon from "@mui/icons-material/Apple";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { AccordionSection } from "../AccordionSection";
import { useCartStore } from "../../../stores/cartStore";
import { useDeviceModelsStore } from "../../../stores/deviceModelsStore";
import { DeviceModel, DeviceInfoMetadata } from "../../../types/cart";
import { formatDateRange } from "../../../utils/date";
import { EmptyStateCompact as EmptyState } from "../../shared/styledComponents";

// Common device info keys for autocomplete suggestions
const COMMON_DEVICE_INFO_KEYS = [
    "Language",
    "Hotspot Password",
    "Factory Number",
    "Time Zone",
    "Hotspot AP Name",
    "BT MAC Address",
    "Phone Activation Time",
    "IMSI",
    "OSVersion",
    "Country",
    "Mac Address",
    "Phone Number",
    "ICCID",
    "Last Used ICCID",
    "Apple ID",
    "Last Activation Time",
    "Product Name",
    "Device Name",
    "Display Name",
    "Product Type",
    "Unique Identifier",
    "Detected manufacturer",
    "Detected model",
    "BlackBerry PIN",
    "IMEI",
    "Backup Password",
    "Product Version",
    "Serial Number",
    "Is Encrypted",
    "Android ID",
];

// Manufacturer logo components - returns icon/text for the manufacturer
const getManufacturerLogo = (manufacturer: string | null): React.ReactNode => {
    if (!manufacturer) return <SmartphoneIcon sx={{ fontSize: 20 }} />;

    // Apple/iPhone gets Apple icon
    if (manufacturer === "iPhone" || manufacturer.toLowerCase().includes("apple")) {
        return <AppleIcon sx={{ fontSize: 20 }} />;
    }

    // For other manufacturers, show abbreviation
    const abbreviations: Record<string, string> = {
        Samsung: "S",
        Huawei: "H",
        Xiaomi: "Mi",
        OnePlus: "1+",
        Google: "G",
        Pixel: "Px",
        Sony: "So",
        LG: "LG",
        Motorola: "M",
        Nokia: "N",
        HTC: "HTC",
        Oppo: "Op",
        Vivo: "V",
        Realme: "R",
        Asus: "As",
        Lenovo: "Le",
        ZTE: "Z",
        Meizu: "Mz",
        Honor: "Hr",
        Redmi: "Rd",
        Nexus: "Nx",
        BlackBerry: "BB",
        Tecno: "T",
        Razer: "Rz",
        TCL: "TCL",
    };

    const abbr = abbreviations[manufacturer] ?? manufacturer.slice(0, 2).toUpperCase();
    return (
        <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
            {abbr}
        </Typography>
    );
};


const DeviceContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(1, 0),
    width: '100%',
}));

const DeviceHeader = styled(Box)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
}));

const DeviceLogo = styled(Box)<{ os?: string }>(({ theme, os }) => ({
    width: 40,
    height: 40,
    borderRadius: theme.shape.borderRadius,
    background: os === "ios"
        ? `linear-gradient(135deg, ${theme.custom.surface.white10} 0%, ${theme.custom.surface.white8} 100%)`
        : `linear-gradient(135deg, ${theme.custom.status.success.background} 0%, ${theme.custom.surface.primary8} 100%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: os === "ios" ? theme.palette.text.primary : theme.custom.status.success.main,
}));

const DeviceName = styled(Typography)(({ theme }) => ({
    fontSize: "0.9375rem",
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.primary,
}));

const DeviceDetails = styled(Box)(({ theme }) => ({
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
}));

const DetailRow = styled(Box)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
}));

const DetailLabel = styled(Typography)(({ theme }) => ({
    fontSize: "0.75rem",
    color: theme.palette.text.disabled,
    width: 80,
}));

const DetailValue = styled(Typography)(({ theme }) => ({
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
}));

const EditContainer = styled(Box)(({ theme }) => ({
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    padding: theme.spacing(2, 0),
    borderTop: `1px solid ${theme.custom.border.default}`,
    marginTop: theme.spacing(1.5),
}));

const EditActions = styled(Box)(({ theme }) => ({
    display: "flex",
    justifyContent: "flex-end",
    gap: theme.spacing(1),
}));

// Helper to get display label for a device model
const getModelLabel = (model: DeviceModel): string =>
    `${model.manufacturer} ${model.name} (${model.os.toUpperCase()})`;

interface DeviceInfoSectionProps {
    embedded?: boolean;
}

export function DeviceInfoSection({ embedded = false }: DeviceInfoSectionProps) {
    const { job, getSectionItemCount, updateDeviceContext, updateDeviceInfo, isSaving } = useCartStore();
    const { isLoading: modelsLoading, deviceModels, error: modelsError } = useDeviceModelsStore();

    const itemCount = getSectionItemCount("deviceContext");
    const context = job?.context;
    const device = context?.device;
    const deviceInfo = job?.device_info ?? [];

    // Separate edit states for device context and device metadata
    const [isEditingContext, setIsEditingContext] = useState(false);
    const [isEditingMetadata, setIsEditingMetadata] = useState(false);
    
    const [editModel, setEditModel] = useState<DeviceModel | null>(device ?? null);
    const [editStartDate, setEditStartDate] = useState<string>(context?.start_date ?? "");
    const [editEndDate, setEditEndDate] = useState<string>(context?.end_date ?? "");
    const [editDeviceInfo, setEditDeviceInfo] = useState<DeviceInfoMetadata[]>(deviceInfo);
    
    const [contextSaveError, setContextSaveError] = useState<string | null>(null);
    const [metadataSaveError, setMetadataSaveError] = useState<string | null>(null);

    // Build device model string from manufacturer and name
    const deviceModel = device ? `${device.manufacturer} ${device.name}` : null;
    const deviceOS = device?.os ?? null;

    // Device Context (Model & OS) edit handlers
    const handleStartEditContext = () => {
        setEditModel(device ?? null);
        setEditStartDate(context?.start_date ?? "");
        setEditEndDate(context?.end_date ?? "");
        setContextSaveError(null);
        setIsEditingContext(true);
    };

    const handleCancelEditContext = () => {
        setIsEditingContext(false);
        setEditModel(device ?? null);
        setEditStartDate(context?.start_date ?? "");
        setEditEndDate(context?.end_date ?? "");
        setContextSaveError(null);
    };

    const handleSaveEditContext = async () => {
        if (!editModel) return;

        setContextSaveError(null);
        try {
            await updateDeviceContext({
                device: editModel,
                start_date: editStartDate || null,
                end_date: editEndDate || null,
                country_info: context?.country_info ?? null,
            });
            setIsEditingContext(false);
        } catch (error: unknown) {
            let errorMessage = "Failed to save device context";
            setContextSaveError(errorMessage);
            console.error("Failed to save device context:", error);
        }
    };

    // Device Metadata edit handlers
    const handleStartEditMetadata = () => {
        setEditDeviceInfo([...deviceInfo]);
        setMetadataSaveError(null);
        setIsEditingMetadata(true);
    };

    const handleCancelEditMetadata = () => {
        setIsEditingMetadata(false);
        setEditDeviceInfo([...deviceInfo]);
        setMetadataSaveError(null);
    };

    const handleSaveEditMetadata = async () => {
        setMetadataSaveError(null);
        try {
            await updateDeviceInfo(editDeviceInfo);
            setIsEditingMetadata(false);
        } catch (error: unknown) {
            let errorMessage = "Failed to save device metadata";
            setMetadataSaveError(errorMessage);
            console.error("Failed to save device metadata:", error);
        }
    };

    const handleAddDeviceInfoEntry = () => {
        setEditDeviceInfo([...editDeviceInfo, { key: "", value: "" }]);
    };

    const handleRemoveDeviceInfoEntry = (index: number) => {
        setEditDeviceInfo(editDeviceInfo.filter((_, i) => i !== index));
    };

    const handleUpdateDeviceInfoKey = (index: number, key: string) => {
        const updated = [...editDeviceInfo];
        updated[index] = { ...updated[index], key };
        setEditDeviceInfo(updated);
    };

    const handleUpdateDeviceInfoValue = (index: number, value: string) => {
        const updated = [...editDeviceInfo];
        updated[index] = { ...updated[index], value };
        setEditDeviceInfo(updated);
    };



    const content = !context ? (
        <EmptyState>
            <SmartphoneIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="textSecondary">
                No device context set
            </Typography>
        </EmptyState>
    ) : (
        <DeviceContainer>
            {/* Device Model & OS Section */}
            <DeviceHeader>
                <DeviceLogo os={deviceOS ?? undefined}>
                    {getManufacturerLogo(device?.manufacturer ?? null)}
                </DeviceLogo>
                <Box sx={{ flex: 1 }}>
                    <DeviceName>
                        {deviceModel || "Unknown Device"}
                    </DeviceName>
                    <Typography variant="caption" color="textSecondary">
                        {deviceOS?.toUpperCase() || "Unknown OS"}
                    </Typography>
                </Box>
                <IconButton
                    size="small"
                    onClick={isEditingContext ? handleCancelEditContext : handleStartEditContext}
                    disabled={isSaving}
                >
                    {isEditingContext ? <CloseIcon fontSize="small" /> : <EditIcon fontSize="small" />}
                </IconButton>
            </DeviceHeader>

            <Collapse in={isEditingContext}>
                <EditContainer>
                    {modelsLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : modelsError ? (
                        <Typography color="error" variant="body2" sx={{ py: 2, textAlign: 'center' }}>
                            Failed to load device models: {modelsError}
                        </Typography>
                    ) : deviceModels.length === 0 ? (
                        <Typography color="textSecondary" variant="body2" sx={{ py: 2, textAlign: 'center' }}>
                            No device models available
                        </Typography>
                    ) : (
                        <>
                            <Autocomplete
                                size="small"
                                options={deviceModels}
                                value={editModel}
                                onChange={(_, newValue) => setEditModel(newValue)}
                                getOptionLabel={getModelLabel}
                                isOptionEqualToValue={(option, value) =>
                                    option.manufacturer === value.manufacturer &&
                                    option.name === value.name &&
                                    option.os === value.os
                                }
                                groupBy={(option) => option.os.toUpperCase()}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Device Model"
                                        placeholder="Search for a device..."
                                    />
                                )}
                                renderOption={(props, option) => {
                                    const { key, ...restProps } = props as { key: string } & React.HTMLAttributes<HTMLLIElement>;
                                    return (
                                        <li key={key} {...restProps}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {getManufacturerLogo(option.manufacturer)}
                                                <span>{option.manufacturer} {option.name}</span>
                                            </Box>
                                        </li>
                                    );
                                }}
                                slotProps={{
                                    popper: {
                                        sx: { zIndex: 9999 },
                                        placement: 'bottom-start',
                                    },
                                    listbox: {
                                        sx: { maxHeight: 300 },
                                    },
                                }}
                                fullWidth
                            />

                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    size="small"
                                    label="Start Date"
                                    type="date"
                                    value={editStartDate?.split('T')[0] ?? ''}
                                    onChange={(e) => setEditStartDate(e.target.value ? `${e.target.value}T00:00:00` : '')}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    fullWidth
                                />
                                <TextField
                                    size="small"
                                    label="End Date"
                                    type="date"
                                    value={editEndDate?.split('T')[0] ?? ''}
                                    onChange={(e) => setEditEndDate(e.target.value ? `${e.target.value}T23:59:59` : '')}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    fullWidth
                                />
                            </Box>

                            {contextSaveError && (
                                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                                    {contextSaveError}
                                </Typography>
                            )}

                            <EditActions>
                                <IconButton
                                    size="small"
                                    onClick={handleCancelEditContext}
                                    disabled={isSaving}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={handleSaveEditContext}
                                    disabled={!editModel || isSaving}
                                >
                                    {isSaving ? (
                                        <CircularProgress size={18} />
                                    ) : (
                                        <CheckIcon fontSize="small" />
                                    )}
                                </IconButton>
                            </EditActions>
                        </>
                    )}
                </EditContainer>
            </Collapse>

            {!isEditingContext && (
                <DeviceDetails>
                    <DetailRow>
                        <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                        <DetailLabel>Timerange</DetailLabel>
                        <DetailValue>
                            {formatDateRange(context.start_date, context.end_date)}
                        </DetailValue>
                    </DetailRow>

                    {context.country_info && (
                        <DetailRow>
                            <LocationOnIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                            <DetailLabel>Country</DetailLabel>
                            <DetailValue>{context.country_info.name}</DetailValue>
                        </DetailRow>
                    )}
                </DeviceDetails>
            )}

            {/* Device Metadata Section */}
            <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 1.5 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                        Device Metadata {!isEditingMetadata && deviceInfo.length > 0 && `(${deviceInfo.length})`}
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={isEditingMetadata ? handleCancelEditMetadata : handleStartEditMetadata}
                        disabled={isSaving}
                    >
                        {isEditingMetadata ? <CloseIcon fontSize="small" /> : <EditIcon fontSize="small" />}
                    </IconButton>
                </Box>

                <Collapse in={isEditingMetadata}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <IconButton size="small" onClick={handleAddDeviceInfoEntry} color="primary">
                                <AddIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        {editDeviceInfo.map((entry, index) => (
                            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Autocomplete
                                    size="small"
                                    freeSolo
                                    options={COMMON_DEVICE_INFO_KEYS}
                                    value={entry.key}
                                    onChange={(_, newValue) => handleUpdateDeviceInfoKey(index, newValue ?? '')}
                                    onInputChange={(_, newValue) => handleUpdateDeviceInfoKey(index, newValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Key"
                                            placeholder="Enter key..."
                                        />
                                    )}
                                    slotProps={{
                                        popper: {
                                            sx: { zIndex: 9999 },
                                        },
                                    }}
                                    sx={{ flex: 1 }}
                                />
                                <TextField
                                    size="small"
                                    label="Value"
                                    placeholder="Enter value..."
                                    value={entry.value}
                                    onChange={(e) => handleUpdateDeviceInfoValue(index, e.target.value)}
                                    sx={{ flex: 1 }}
                                />
                                <IconButton
                                    size="small"
                                    onClick={() => handleRemoveDeviceInfoEntry(index)}
                                    color="error"
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        ))}

                        {editDeviceInfo.length === 0 && (
                            <Typography variant="body2" color="textDisabled" sx={{ textAlign: 'center', py: 1 }}>
                                No metadata entries. Click + to add.
                            </Typography>
                        )}

                        {metadataSaveError && (
                            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                                {metadataSaveError}
                            </Typography>
                        )}

                        <EditActions>
                            <IconButton
                                size="small"
                                onClick={handleCancelEditMetadata}
                                disabled={isSaving}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                color="primary"
                                onClick={handleSaveEditMetadata}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <CircularProgress size={18} />
                                ) : (
                                    <CheckIcon fontSize="small" />
                                )}
                            </IconButton>
                        </EditActions>
                    </Box>
                </Collapse>

                {!isEditingMetadata && deviceInfo.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                        {deviceInfo.map((entry, index) => (
                            <DetailRow key={index}>
                                <DetailLabel sx={{ width: 'auto', minWidth: 80, maxWidth: 120 }}>{entry.key}</DetailLabel>
                                <DetailValue sx={{ flex: 1, wordBreak: 'break-word' }}>{entry.value}</DetailValue>
                            </DetailRow>
                        ))}
                    </Box>
                )}

                {!isEditingMetadata && deviceInfo.length === 0 && (
                    <Typography variant="body2" color="textDisabled" sx={{ textAlign: 'center', py: 1 }}>
                        No metadata entries
                    </Typography>
                )}
            </Box>
        </DeviceContainer>
    );

    if (embedded) {
        return <Box sx={{ padding: 2 }}>{content}</Box>;
    }

    return (
        <AccordionSection
            sectionKey="deviceContext"
            title={"Device Info"}
            icon={<SmartphoneIcon />}
            itemCount={itemCount}
        >
            {content}
        </AccordionSection>
    );
}
