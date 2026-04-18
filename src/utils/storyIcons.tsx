import LocationOnIcon from "@mui/icons-material/LocationOn";
import ImageIcon from "@mui/icons-material/Image";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import VideocamIcon from "@mui/icons-material/Videocam";
import DescriptionIcon from "@mui/icons-material/Description";
import ChatIcon from "@mui/icons-material/Chat";
import RouteIcon from "@mui/icons-material/Route";
import AppsIcon from "@mui/icons-material/Apps";
import ContactsIcon from "@mui/icons-material/Contacts";
import { StoryType } from "../types/cart";

/**
 * Get icon element for a story type
 */
export function getStoryIcon(
    storyType: StoryType,
    fontSize: "small" | "medium" | "large" | "inherit" = "small"
): React.ReactElement | undefined {
    switch (storyType) {
        case "location":
            return <LocationOnIcon fontSize={fontSize} />;
        case "image":
            return <ImageIcon fontSize={fontSize} />;
        case "audio":
            return <AudiotrackIcon fontSize={fontSize} />;
        case "video":
            return <VideocamIcon fontSize={fontSize} />;
        case "document":
            return <DescriptionIcon fontSize={fontSize} />;
        case "chat":
            return <ChatIcon fontSize={fontSize} />;
        case "route":
            return <RouteIcon fontSize={fontSize} />;
        case "app":
            return <AppsIcon fontSize={fontSize} />;
        case "contact":
            return <ContactsIcon fontSize={fontSize} />;
        default:
            return undefined;
    }
}

/**
 * Get human-readable name for a story type
 */
export function getStoryTypeName(storyType: StoryType): string {
    return storyType.charAt(0).toUpperCase() + storyType.slice(1);
}
