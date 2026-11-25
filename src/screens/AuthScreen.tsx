import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface AuthScreenProps {
  onAuthSuccess: (user: any, rememberMe: boolean) => void;
  notice?: string | null;
}

export function AuthScreen({ onAuthSuccess, notice }: AuthScreenProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const passwordInputRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    if (loading) return;

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setErrorMsg('Preencha usuário e senha.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const rpcName = isRegister ? 'register_user' : 'login_user';
      const { data, error } = await supabase.rpc(rpcName, {
        p_username: cleanUser,
        p_password: password,
      });

      if (error || !data) {
        throw new Error(error?.message || 'Falha na autenticação.');
      }

      onAuthSuccess(data, rememberMe);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>KAOS CARDS</Text>
          <Text style={styles.subtitle}>
            {isRegister ? 'Criar nova conta' : 'Entrar na arena'}
          </Text>

          {/* Aviso em vermelho caso a conta tenha sido conectada em outro aparelho */}
          {notice && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Nome de usuário"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            returnKeyType="next"
            value={username}
            onChangeText={setUsername}
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />

          <TextInput
            ref={passwordInputRef}
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#64748b"
            secureTextEntry
            returnKeyType="go"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSubmit}
          />

          <TouchableOpacity
            style={styles.rememberRow}
            activeOpacity={0.75}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.rememberText}>Manter conectado neste aparelho</Text>
          </TouchableOpacity>

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.disabledBtn]}
            disabled={loading}
            onPress={handleSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isRegister ? 'Cadastrar e Entrar' : 'Entrar'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => {
              setErrorMsg(null);
              setIsRegister(!isRegister);
            }}
          >
            <Text style={styles.switchText}>
              {isRegister
                ? 'Já tem conta? Faça login'
                : 'Não tem conta? Cadastre-se'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  noticeBox: {
    backgroundColor: '#450a0a',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  noticeText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#64748b',
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  rememberText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  switchBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  switchText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
  },
});