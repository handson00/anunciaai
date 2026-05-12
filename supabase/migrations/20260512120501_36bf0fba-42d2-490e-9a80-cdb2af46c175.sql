-- Verificar se o bucket existe, se não, criar
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-photos', 'ad-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para o bucket ad-photos

-- 1. Permitir que qualquer pessoa veja as fotos
CREATE POLICY "Fotos são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-photos');

-- 2. Permitir que usuários autenticados façam upload de fotos para sua própria pasta
CREATE POLICY "Usuários podem fazer upload de suas próprias fotos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ad-photos' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Permitir que usuários excluam suas próprias fotos
CREATE POLICY "Usuários podem excluir suas próprias fotos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ad-photos' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
