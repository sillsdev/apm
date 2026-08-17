export interface BibleImage {
  id: number;
  uuid: string;
  title: string;
  keywords: string[];
  styles: string[];
  orig_url: string;
  thumb_url_small: string;
  thumb_url_large: string;
  s3key: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  submitted_by: string;
  submitted_by_email: string;
  is_published: boolean;
  is_featured: boolean;
  updated_by: string;
  updated_by_email: string;
  description: string | null;
  external_id: string | null;
  default_language_code: string;
  original_file_name: string | null;
  authors: string | null;
  copyright: string | null;
  scriptures: string[];
}
