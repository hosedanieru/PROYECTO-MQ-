import { describe, expect, it } from 'vitest';

import { Remision, type DatosNuevaRemision } from './remision.entity.js';
import {
  DatosRemisionInvalidosError,
  InformacionIncompletaError,
  TransicionEstadoInvalidaError,
} from './remision.errors.js';

const FECHA_OPERATIVA = new Date('2026-09-14T00:00:00.000Z');
const MOMENTO = new Date('2026-09-14T09:30:00-05:00');

function datosValidos(
  sobrescribir: Partial<DatosNuevaRemision> = {},
): DatosNuevaRemision {
  return {
    anio: 2026,
    numero: 1,
    fechaOperativa: FECHA_OPERATIVA,
    fechaHoraRegistro: MOMENTO,
    turnoId: 'turno-t1',
    proveedorId: 'prov-logicmard',
    lugarId: 'lugar-mq',
    productoId: 'prod-1',
    codigoSnapshot: '300058141',
    descripcionSnapshot: 'SURTIDO MEGA LONCHERA 586GX3X1 BX22',
    fechaVencimiento: new Date('2027-03-01T00:00:00.000Z'),
    cantidadCajas: 36,
    cantidadUnidades: 144,
    estibasCompletas: 1,
    cajasSueltas: 0,
    numerosEstiba: [31],
    observaciones: null,
    creadaPorId: 'user-coordinador',
    ...sobrescribir,
  };
}

/** Atajo: crea una remisión y la lleva hasta el estado indicado. */
function remisionEn(estado: 'ENTREGADA' | 'APROBADA' | 'RECHAZADA'): Remision {
  const remision = Remision.crear(datosValidos());
  remision.entregar('user-patinador', MOMENTO);

  if (estado === 'APROBADA') {
    remision.aprobar('Edwin', 'Facturador', MOMENTO);
  }
  if (estado === 'RECHAZADA') {
    remision.rechazar('Cantidad de cajas no coincide');
  }

  return remision;
}

describe('Remision.crear', () => {
  it('crea la remisión en estado BORRADOR', () => {
    const remision = Remision.crear(datosValidos());

    expect(remision.estado).toBe('BORRADOR');
    expect(remision.version).toBe(1);
    expect(remision.esEditable).toBe(true);
  });

  it('arma el consecutivo con el año y el número a cuatro dígitos', () => {
    const remision = Remision.crear(datosValidos({ numero: 7 }));
    expect(remision.consecutivo).toBe('2026-0007');
  });

  it('ordena los números de estiba', () => {
    const remision = Remision.crear(
      datosValidos({ numerosEstiba: [35, 31, 33], estibasCompletas: 3 }),
    );
    expect(remision.aObjeto().numerosEstiba).toEqual([31, 33, 35]);
  });

  it('normaliza observaciones vacías a null', () => {
    const remision = Remision.crear(datosValidos({ observaciones: '   ' }));
    expect(remision.aObjeto().observaciones).toBeNull();
  });

  describe('validaciones', () => {
    it('rechaza cantidad de cajas en cero', () => {
      expect(() => Remision.crear(datosValidos({ cantidadCajas: 0 }))).toThrow(
        DatosRemisionInvalidosError,
      );
    });

    it('rechaza cantidades negativas', () => {
      expect(() =>
        Remision.crear(datosValidos({ cantidadUnidades: -10 })),
      ).toThrow(DatosRemisionInvalidosError);
    });

    it('rechaza cantidades no enteras', () => {
      expect(() =>
        Remision.crear(datosValidos({ cantidadCajas: 36.5 })),
      ).toThrow(DatosRemisionInvalidosError);
    });

    it('rechaza una remisión sin estibas ni cajas sueltas', () => {
      expect(() =>
        Remision.crear(datosValidos({ estibasCompletas: 0, cajasSueltas: 0 })),
      ).toThrow(DatosRemisionInvalidosError);
    });

    it('acepta solo cajas sueltas, sin estibas completas', () => {
      const remision = Remision.crear(
        datosValidos({ estibasCompletas: 0, cajasSueltas: 21 }),
      );
      expect(remision.descripcionEstibas).toBe('21 cajas');
    });

    it('rechaza el vencimiento anterior a la fecha operativa', () => {
      expect(() =>
        Remision.crear(
          datosValidos({ fechaVencimiento: new Date('2026-01-01T00:00:00Z') }),
        ),
      ).toThrow(DatosRemisionInvalidosError);
    });

    it('rechaza números de estiba repetidos', () => {
      expect(() =>
        Remision.crear(datosValidos({ numerosEstiba: [31, 31] })),
      ).toThrow(DatosRemisionInvalidosError);
    });

    it('rechaza un número de estiba en cero o negativo', () => {
      expect(() =>
        Remision.crear(datosValidos({ numerosEstiba: [0] })),
      ).toThrow(DatosRemisionInvalidosError);
    });

    it('rechaza el código de producto vacío', () => {
      expect(() =>
        Remision.crear(datosValidos({ codigoSnapshot: '  ' })),
      ).toThrow(DatosRemisionInvalidosError);
    });
  });
});

describe('Remision.desdePersistencia', () => {
  it('no comparte el arreglo de estibas con el estado de origen', () => {
    const estado = Remision.crear(datosValidos()).aObjeto();
    const remision = Remision.desdePersistencia(estado);

    estado.numerosEstiba.push(99);

    expect(remision.aObjeto().numerosEstiba).toEqual([31]);
  });
});

describe('descripcionEstibas', () => {
  it('usa singular con una sola estiba', () => {
    const remision = Remision.crear(datosValidos({ estibasCompletas: 1 }));
    expect(remision.descripcionEstibas).toBe('1 estiba');
  });

  it('combina estibas completas y cajas sueltas', () => {
    const remision = Remision.crear(
      datosValidos({ estibasCompletas: 2, cajasSueltas: 21 }),
    );
    expect(remision.descripcionEstibas).toBe('2 estibas + 21 cajas');
  });
});

describe('flujo de estados', () => {
  it('BORRADOR → ENTREGADA', () => {
    const remision = Remision.crear(datosValidos());
    remision.entregar('user-patinador', MOMENTO);

    expect(remision.estado).toBe('ENTREGADA');
    expect(remision.esEditable).toBe(false);
  });

  it('ENTREGADA → APROBADA registra al OPA como dato', () => {
    const remision = remisionEn('APROBADA');

    expect(remision.estado).toBe('APROBADA');
    expect(remision.aObjeto().opaNombre).toBe('Edwin');
    expect(remision.estaPendienteDeConciliar).toBe(true);
  });

  it('APROBADA → VALIDADA cierra la conciliación', () => {
    const remision = remisionEn('APROBADA');
    remision.validar('user-coordinador', 'Edwin', MOMENTO);

    expect(remision.estado).toBe('VALIDADA');
    expect(remision.estaPendienteDeConciliar).toBe(false);
    expect(remision.aObjeto().conciliadoCon).toBe('Edwin');
  });

  it('ENTREGADA → RECHAZADA conserva el motivo del rechazo', () => {
    const remision = remisionEn('RECHAZADA');

    expect(remision.estado).toBe('RECHAZADA');
    expect(remision.motivoRechazo).toBe('Cantidad de cajas no coincide');
  });

  it('RECHAZADA → EN_RECTIFICACION incrementa la versión sin cambiar el consecutivo', () => {
    const remision = remisionEn('RECHAZADA');
    const consecutivoOriginal = remision.consecutivo;

    remision.iniciarRectificacion();

    expect(remision.estado).toBe('EN_RECTIFICACION');
    expect(remision.version).toBe(2);
    expect(remision.consecutivo).toBe(consecutivoOriginal);
    expect(remision.esEditable).toBe(true);
  });

  it('una remisión rectificada vuelve a entregarse', () => {
    const remision = remisionEn('RECHAZADA');
    remision.iniciarRectificacion();
    remision.entregar('user-patinador', MOMENTO);

    expect(remision.estado).toBe('ENTREGADA');
  });

  describe('transiciones prohibidas', () => {
    it('no se puede aprobar un borrador sin entregarlo', () => {
      const remision = Remision.crear(datosValidos());
      expect(() => remision.aprobar('Edwin', null, MOMENTO)).toThrow(
        TransicionEstadoInvalidaError,
      );
    });

    it('no se puede validar sin aprobación previa del OPA', () => {
      const remision = remisionEn('ENTREGADA');
      expect(() =>
        remision.validar('user-coordinador', 'Edwin', MOMENTO),
      ).toThrow(TransicionEstadoInvalidaError);
    });

    it('una remisión validada no admite más cambios', () => {
      const remision = remisionEn('APROBADA');
      remision.validar('user-coordinador', 'Edwin', MOMENTO);

      expect(() => remision.entregar('user-patinador', MOMENTO)).toThrow(
        TransicionEstadoInvalidaError,
      );
    });

    it('no se puede rechazar una remisión ya aprobada', () => {
      const remision = remisionEn('APROBADA');
      expect(() => remision.rechazar('motivo')).toThrow(
        TransicionEstadoInvalidaError,
      );
    });
  });

  describe('información obligatoria', () => {
    it('el rechazo exige motivo', () => {
      const remision = remisionEn('ENTREGADA');
      expect(() => remision.rechazar('   ')).toThrow(
        InformacionIncompletaError,
      );
    });

    it('la aprobación exige el nombre del OPA', () => {
      const remision = remisionEn('ENTREGADA');
      expect(() => remision.aprobar('  ', null, MOMENTO)).toThrow(
        InformacionIncompletaError,
      );
    });

    it('la validación exige el contacto de conciliación', () => {
      const remision = remisionEn('APROBADA');
      expect(() => remision.validar('user-coordinador', '  ', MOMENTO)).toThrow(
        InformacionIncompletaError,
      );
    });
  });
});
