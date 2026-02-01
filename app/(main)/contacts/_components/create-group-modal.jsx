"use client";

import { api } from '@/convex/_generated/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@radix-ui/react-label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useConvexQuery } from '@/hooks/use-convex-query';

const groupSchema = z.object({
  name: z.string().min(2, "Group name must be at least 2 characters long"),
  description: z.string().optional(),
}) ;

const CreateGroupModal = ({isOpen, onClose, onSuccess}) => {
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [ searchQuery, setSearchQuery ] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  
  const {data : currentUser} = useConvexQuery(api.users.getCurrentUser);
  const {data: searchResults, isLoading: isSearching} = useConvexQuery(api.users.searchUsers);

  const{
    register, 
    handleSubmit, 
    formState:{errors, isSubmitting},
    reset
  } = useForm({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleClose = () => {
    reset();

    //reset the form 
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your account and remove your data from our
            servers.
          </DialogDescription>
        </DialogHeader>

        <form className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor="name">Group Name</Label>
            <Input id="name" placeholder="Enter group name" 
            {...register('name')}
            />
            {errors.name && <p className='text-sm text-red-600 mt-1'>{errors.name.message}</p>}
          </div>

          <div className='space-y-2'>
            <Label htmlFor="description">Description (Optional)</Label>
            <Input id="description" placeholder="Enter group description" 
            {...register('description')}
            />
            {/* {errors.description && <p className='text-sm text-red-600 mt-1'>{errors.description.message}</p>} */}
          </div>

          <div className='space-y-2'>
            <Label htmlFor="members">Members</Label>
            <div className='flex flex-wrap gap-2 mb-2'>
              {currentUser && (
                <Badge variant="secondary" className='px-3 py-1'>
                  <Avatar className="h-5 w-5 mr-2">
                    <AvatarImage src={currentUser.imageUrl}/>
                      <AvatarFallback className="uppercase">
                        {currentUser.name?.charAt(0) || "?"}
                      </AvatarFallback>
                  </Avatar>
                  <span>{currentUser.name} (You)</span>
                </Badge>
              )}

              {/* Selected Members */}
            </div>
          </div>
        </form>

        <DialogFooter>
          Footer
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal;