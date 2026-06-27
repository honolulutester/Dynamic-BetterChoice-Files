-- Migration: Add email and birthdate to orders table for marketing analysis

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS birthdate date;
