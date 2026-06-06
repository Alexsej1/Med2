import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { api } from "./api";

const SymptomLabelsContext = createContext<Record<string, string>>({});

export function SymptomLabelsProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token || !user) {
      setMap({});
      return;
    }
    let cancelled = false;
    void api
      .symptomLabels(token)
      .then((m) => {
        if (!cancelled) setMap(m);
      })
      .catch(() => {
        if (!cancelled) setMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  return <SymptomLabelsContext.Provider value={map}>{children}</SymptomLabelsContext.Provider>;
}

export function useSymptomLabels(): Record<string, string> {
  return useContext(SymptomLabelsContext);
}
