import { supabase } from '../lib/supabase';
import { UserProfile } from '../types/game';

export class AuthService {
  static async register(username: string, password: string): Promise<UserProfile> {
    const { data, error } = await supabase.rpc('register_user', {
      p_username: username,
      p_password: password,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao cadastrar usuário.');
    }

    return data as UserProfile;
  }

  static async login(username: string, password: string): Promise<UserProfile> {
    const { data, error } = await supabase.rpc('login_user', {
      p_username: username,
      p_password: password,
    });

    if (error) {
      throw new Error(error.message || 'Usuário ou senha inválidos.');
    }

    return data as UserProfile;
  }
}
