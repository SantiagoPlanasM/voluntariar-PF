// test/unit/donation-amount.test.js — monto de una donación: clases de equivalencia, valores límite y cobertura de
// sentencia y de decisión de amountError() (routes/donaciones.js). TP de Calidad, eje 5 (T6; PROJECT_ANALYSIS.md §199).
//
// Criterio de aceptación (de §170, decisión de diseño): se dona en PESOS ENTEROS entre $100 y $500.000 inclusive.
// Cualquier otra cosa → mensaje en español (null = válido). Diseño de casos (docs/calidad/DISENO_CASOS.md §1):
//
//   Clase                                      | Representantes               | Resultado
//   EC1 no es un número                        | '1500', null, undefined, true, [1500], {} | "número entero de pesos"
//   EC2 número no entero o no finito           | 100.5, NaN, Infinity         | "número entero de pesos"
//   EC3 entero menor al mínimo                 | -500, 0, 99                  | "mínimo es de $100"
//   EC4 entero en el rango (válida)            | 2500                         | null
//   EC5 entero mayor al máximo                 | 500001, 1e21                 | "máximo es de $500.000"
//   Valores límite: 99 | 100 | 101 y 499999 | 500000 | 500001.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { amountError } = require('../../src/routes/donaciones');

const ENTERO = 'El monto tiene que ser un número entero de pesos';
const MINIMO = 'El monto mínimo es de $100';
const MAXIMO = 'El monto máximo es de $500.000';

describe('amountError — clases de equivalencia', () => {
  test('EC1: lo que no es un número → "número entero"', () => {
    // Arrange
    const inputs = ['1500', null, undefined, true, [1500], {}];
    // Act
    const results = inputs.map(amountError);
    // Assert
    assert.deepEqual(results, inputs.map(() => ENTERO));
  });

  test('EC2: número no entero o no finito → "número entero"', () => {
    const inputs = [100.5, NaN, Infinity];
    const results = inputs.map(amountError);
    assert.deepEqual(results, [ENTERO, ENTERO, ENTERO]);
  });

  test('EC3: entero menor al mínimo → "mínimo"', () => {
    const results = [-500, 0, 99].map(amountError);
    assert.deepEqual(results, [MINIMO, MINIMO, MINIMO]);
  });

  test('EC4: un entero del medio del rango es válido (null)', () => {
    const result = amountError(2500);
    assert.equal(result, null);
  });

  test('EC5: entero mayor al máximo → "máximo" (también 1e21, que es entero para JavaScript)', () => {
    const results = [500001, 1e21].map(amountError);
    assert.deepEqual(results, [MAXIMO, MAXIMO]);
  });
});

describe('amountError — valores límite', () => {
  test('borde inferior: 99 no, 100 y 101 sí', () => {
    // Arrange
    const bordes = [99, 100, 101];
    // Act
    const results = bordes.map(amountError);
    // Assert
    assert.deepEqual(results, [MINIMO, null, null]);
  });

  test('borde superior: 499.999 y 500.000 sí, 500.001 no', () => {
    const results = [499999, 500000, 500001].map(amountError);
    assert.deepEqual(results, [null, null, MAXIMO]);
  });
});
