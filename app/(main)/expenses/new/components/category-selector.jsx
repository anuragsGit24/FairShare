"use client";

import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Select } from "@radix-ui/react-select";
import React, { useEffect, useState } from "react";

const CategorySelector = ({ categories, onChange }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  //Handle when a category is selected
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);

    //only call onchange if it exists and the value has changed
    if(onChange && categoryId !== selectedCategory){
      onChange(categoryId);
    }
  };

  //if no categories or empty categories, return null
  if(!categories || categories.length === 0){ 
      return <div>No categories available</div>;
  }

  useEffect(() => {
    //set the default value if not already set
    if (!selectedCategory && categories.length > 0) {
      //find a default category, if not found use the first category
      const defaultCategory =
        categories.find((cat) => cat.isDefault) || categories[0];

      //set the default category without triggering a rerender loop
      setTimeout(() => {
        setSelectedCategory(defaultCategory.id);
        if (onChange) {
          onChange(defaultCategory.id);
        }
      }, 0);
    }
  }, []);

  
   
  return (
    <Select value={selectedCategory} onValueChange={handleCategoryChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id} >
            <div className="flex items-center gap-2">
              <span>{category.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CategorySelector;