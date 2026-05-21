'use client';

import { Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import { Input } from '@kit/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';

type DatePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function DatePickerField({
  id,
  value,
  onChange,
  placeholder = 'Pick a date',
}: DatePickerFieldProps) {
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(next) => {
            if (!next) return;
            onChange(next.toISOString().slice(0, 10));
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

type DateTimePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
};

export function DateTimePickerField({
  id,
  value,
  onChange,
}: DateTimePickerFieldProps) {
  const dateValue = value.includes('T') ? value.slice(0, 10) : '';
  const timeValue = value.includes('T') ? value.slice(11, 16) : '';

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <DatePickerField
          id={id}
          value={dateValue}
          onChange={(nextDate) =>
            onChange(`${nextDate}T${timeValue || '00:00'}`)
          }
          placeholder="Pick date"
        />
      </div>
      <Input
        type="time"
        value={timeValue}
        onChange={(event) => {
          const nextTime = event.target.value;
          if (!nextTime) {
            onChange('');
            return;
          }

          onChange(`${dateValue || new Date().toISOString().slice(0, 10)}T${nextTime}`);
        }}
        className="w-36"
      />
    </div>
  );
}
