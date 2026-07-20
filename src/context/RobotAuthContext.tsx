import React, { createContext, useContext, useState } from 'react';

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

  const setSession = (newToken: string, newMember: Member) => {
    setToken(newToken);
    setMember(newMember);
  };

  const clearSession = () => {
    setToken(null);
    setMember(null);
  };

  return (
    <RobotAuthContext.Provider value={{ member, token, setSession, clearSession }}>
      {children}
    </RobotAuthContext.Provider>
  );
}

export function useRobotAuth() {
  const ctx = useContext(RobotAuthContext);
  if (!ctx) throw new Error('useRobotAuth must be used within RobotAuthProvider');
  return ctx;
}
