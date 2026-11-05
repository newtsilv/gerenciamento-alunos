-- Acompanhamentos padrão às quartas e sextas
alter table public.challenges alter column monitoring_weekdays set default '{3,5}';
