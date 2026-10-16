// src/lib/donations.test.ts
//
// Donaciones en el frontend (PLAN_FALTANTE.md, Etapa 9; backend en PROJECT_ANALYSIS §170–§171): los métodos de
// api.ts, la validación del monto (los mismos topes y mensajes que el backend) y la lectura de la URL de vuelta de
// Mercado Pago (Checkout Pro agrega external_reference, payment_id/collection_id y status/collection_status).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';
import { DONATION_MAX, DONATION_MIN, checkDonationAmount, formatPesos, readReturnParams } from './donations';

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

describe('api.donaciones', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { localStorage.setItem('v_token', 'tok'); fetchMock = vi.fn(() => json({})); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
  const last = () => {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return { url: String(url), init: init as RequestInit, headers: new Headers((init as RequestInit).headers) };
  };

  test('create: POST JSON a /donaciones con project_id y amount', async () => {
    fetchMock.mockImplementation(() => json({ donation_id: 'd1', checkout_url: 'https://mp/x' }, 201));
    expect(await api.donaciones.create({ project_id: 'proj-1', amount: 1500 })).toEqual({ donation_id: 'd1', checkout_url: 'https://mp/x' });
    const { url, init, headers } = last();
    expect(url).toMatch(/\/donaciones$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ project_id: 'proj-1', amount: 1500 });
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer tok');
  });

  test('get: GET /donaciones/:id (codificado), con payment_id solo si viene', async () => {
    const donation = { id: 'd 1', status: 'pending', amount: 1500, currency: 'ARS', project_id: 'proj-1', project_title: 'X' };
    fetchMock.mockImplementation(() => json({ donation }));
    expect(await api.donaciones.get('d 1')).toEqual({ donation });
    expect(last().url).toMatch(/\/donaciones\/d%201$/);
    await api.donaciones.get('d 1', '123');
    expect(last().url).toMatch(/\/donaciones\/d%201\?payment_id=123$/);
    await api.donaciones.get('d1', '1&x=2');
    expect(last().url).toMatch(/\/donaciones\/d1\?payment_id=1%26x%3D2$/);
  });
});

describe('checkDonationAmount(): lo mismo que rechaza el backend', () => {
  test('topes', () => {
    expect(DONATION_MIN).toBe(100);
    expect(DONATION_MAX).toBe(500000);
  });
  test('vacío, no numérico o con decimales → entero de pesos', () => {
    for (const v of ['', '   ', 'abc', '100.5', '1,5', '1e3', '-', '12abc']) {
      expect(checkDonationAmount(v)).toEqual({ error: 'El monto tiene que ser un número entero de pesos' });
    }
  });
  test('fuera de los topes', () => {
    expect(checkDonationAmount('99')).toEqual({ error: 'El monto mínimo es de $100' });
    expect(checkDonationAmount('0')).toEqual({ error: 'El monto mínimo es de $100' });
    expect(checkDonationAmount('500001')).toEqual({ error: 'El monto máximo es de $500.000' });
  });
  test('válido → { amount } como número (acepta espacios alrededor y los bordes)', () => {
    expect(checkDonationAmount(' 1500 ')).toEqual({ amount: 1500 });
    expect(checkDonationAmount('100')).toEqual({ amount: 100 });
    expect(checkDonationAmount('500000')).toEqual({ amount: 500000 });
  });
});

describe('formatPesos()', () => {
  test('con separador de miles argentino y sin decimales', () => {
    expect(formatPesos(1500)).toBe('$1.500');
    expect(formatPesos(500000)).toBe('$500.000');
    expect(formatPesos(100)).toBe('$100');
  });
});

describe('readReturnParams(): la URL de vuelta de Checkout Pro', () => {
  test('external_reference es el id de la donación; payment_id el del pago; status el que informa Mercado Pago', () => {
    expect(readReturnParams('?collection_id=55&collection_status=approved&payment_id=55&status=approved&external_reference=don-1&preference_id=p'))
      .toEqual({ donationId: 'don-1', paymentId: '55', mpStatus: 'approved' });
  });
  test('si falta payment_id usa collection_id (y collection_status si falta status)', () => {
    expect(readReturnParams('?collection_id=77&collection_status=pending&external_reference=don-2'))
      .toEqual({ donationId: 'don-2', paymentId: '77', mpStatus: 'pending' });
  });
  test('"null" (lo que manda MP cuando no hubo pago) cuenta como ausente', () => {
    expect(readReturnParams('?payment_id=null&collection_id=null&status=null&external_reference=don-3'))
      .toEqual({ donationId: 'don-3', paymentId: null, mpStatus: null });
  });
  test('sin external_reference → donationId null', () => {
    expect(readReturnParams('?payment_id=1').donationId).toBeNull();
    expect(readReturnParams('').donationId).toBeNull();
  });
});
