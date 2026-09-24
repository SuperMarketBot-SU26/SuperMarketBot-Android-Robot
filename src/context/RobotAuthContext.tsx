import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

type Member = {
  memberId: number | string;
  fullName: string | null;
  email: string;
  membershipLevel: string | null;
  shoppingBudget?: number;
  avatarUrl?: string;
};

type RobotAuthContextType = {
  member: Member | null;
  token: string | null;
  setSession: (token: string, member: Member) => void;
  clearSession: () => void;
};

const RobotAuthContext = createContext<RobotAuthContextType | null>(null);

export function RobotAuthProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const setSession = useCallback((newToken: string, newMember: Member) => {
    setToken(newToken);
    setMember(newMember);
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setMember(null);
  }, []);

  const value = useMemo(() => ({
    member,
    token,
    setSession,
    clearSession,
  }), [member, token, setSession, clearSession]);

  return (
    <RobotAuthContext.Provider value={value}>
      {children}
    </RobotAuthContext.Provider>
  );
}

export function useRobotAuth() {
  const ctx = useContext(RobotAuthContext);
  if (!ctx) throw new Error('useRobotAuth must be used within RobotAuthProvider');
  return ctx;
}
