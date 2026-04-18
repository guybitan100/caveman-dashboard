import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from "react";
import { User } from "../types/user";
import {
    getStoredUser,
    saveUser,
    removeUser,
    createUserFromEmail,
} from "../utils/userStorage";

interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    login: (email: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing user on mount
    useEffect(() => {
        const storedUser = getStoredUser();
        if (storedUser) {
            setUser(storedUser);
        }
        setIsLoading(false);
    }, []);

    const login = useCallback((email: string) => {
        const newUser = createUserFromEmail(email);
        saveUser(newUser);
        setUser(newUser);
    }, []);

    const logout = useCallback(() => {
        removeUser();
        setUser(null);
    }, []);

    const value: AuthContextValue = {
        user,
        isLoading,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
