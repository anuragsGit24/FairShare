"use client";

import { api } from '@/convex/_generated/api';
import { useConvexQuery } from '@/hooks/use-convex-query';
import React, { useState } from 'react';

const PersonPage = () => {
  const [activeTab, setActiveTab] = useState("expenses");

  const [data, isLoading] = useConvexQuery(api.expenses.getExpensesBetweenUsers);

  return (
    <div>PersonPage</div>
  );
};

export default PersonPage;