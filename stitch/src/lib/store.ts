import { secureStorage } from './security';

export interface Contact {
  id: string;
  batch_id: string;
  name: string;   // mapped value, kept for legacy compat
  phone: string;  // mapped value, kept for legacy compat
  row_number: number;
  raw_data: Record<string, string>; // all original columns stored as-is
  created_at: string;
}

export interface UploadBatch {
  id: string;
  file_name: string;
  contact_count: number;
  columns: string[]; // original column headers from the file
  created_at: string;
}

export interface Campaign {
  id: string;
  batch_id?: string;
  message: string;
  has_image?: boolean;
  name_column?: string;   // which column was used as the "Name"
  phone_column?: string;  // which column was used as the "Phone"
  range_start?: number;
  range_end?: number;
  search_query?: string;
  status: string;
  created_at: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

class Store {
  private get<T>(key: string): T[] {
    const data = secureStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private set<T>(key: string, data: T[]) {
    secureStorage.setItem(key, JSON.stringify(data));
  }

  // --- Contacts ---
  getContacts(): Contact[] {
    return this.get<Contact>('contacts');
  }

  getContactsByBatch(batch_id: string): Contact[] {
    return this.getContacts().filter(c => c.batch_id === batch_id);
  }

  addContacts(contacts: Omit<Contact, 'id' | 'created_at'>[]): Contact[] {
    const current = this.getContacts();
    const newContacts = contacts.map(c => ({
      ...c,
      id: generateId(),
      created_at: new Date().toISOString()
    }));
    this.set('contacts', [...current, ...newContacts]);
    return newContacts;
  }

  deleteContactsByBatch(batch_id: string) {
    const current = this.getContacts();
    this.set('contacts', current.filter(c => c.batch_id !== batch_id));
  }

  // --- Batches ---
  getBatches(): UploadBatch[] {
    return this.get<UploadBatch>('batches');
  }

  getBatch(id: string): UploadBatch | undefined {
    return this.getBatches().find(b => b.id === id);
  }

  addBatch(batch: Omit<UploadBatch, 'id' | 'created_at'>): UploadBatch {
    const current = this.getBatches();
    const newBatch = {
      ...batch,
      id: generateId(),
      created_at: new Date().toISOString()
    };
    this.set('batches', [newBatch, ...current]);
    return newBatch;
  }

  deleteBatch(id: string) {
    const current = this.getBatches();
    this.set('batches', current.filter(b => b.id !== id));
    this.deleteContactsByBatch(id);
    const campaigns = this.getCampaigns();
    this.set('campaigns', campaigns.filter(c => c.batch_id !== id));
  }

  // --- Campaigns ---
  getCampaigns(): Campaign[] {
    return this.get<Campaign>('campaigns');
  }

  addCampaign(campaign: Omit<Campaign, 'id' | 'created_at'> & { id?: string }): Campaign {
    const current = this.getCampaigns();
    const newCampaign = {
      ...campaign,
      id: campaign.id || generateId(),
      created_at: new Date().toISOString()
    };
    this.set('campaigns', [newCampaign, ...current]);
    return newCampaign;
  }

  // --- Settings ---
  getWebhookUrl(): string {
    return secureStorage.getItem('webhookUrl') || '';
  }

  setWebhookUrl(url: string) {
    secureStorage.setItem('webhookUrl', url);
  }
}

export const db = new Store();
