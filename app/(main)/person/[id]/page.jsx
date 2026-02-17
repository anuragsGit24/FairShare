"use client";

import { api } from '@/convex/_generated/api';
import { useConvexQuery } from '@/hooks/use-convex-query';
import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { BarLoader } from 'react-spinners';
import { Button } from '@/components/ui/button';

const PersonPage = () => {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("expenses");

  const { data, isLoading } = useConvexQuery(
    api.expenses.getExpensesBetweenUsers,
    { userId: params.id }
  );
  
  if(isLoading) {
    return (
      <div className='container mx-auto py-12'>
        <BarLoader width={"100%"} color='#36d7b7'/>
      </div>
    );
  }

  const otherUser = data?.otherUser;
  const expenses = data?.expenses || [];
  const settlements = data?.settlements || [];
  const balance = data?.balance || 0;

  return (
    <div>
      <div className='mb-6'>
        <Button
          variant="outline"
          size="sm"
          className='mb-4'
          onClick={() => router.back()}
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
              Back
        </Button>
      </div>
    </div>
  )
};

export default PersonPage;