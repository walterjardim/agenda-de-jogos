import { useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from '../../../shared/components/ActionButton';
import { FormField } from '../../../shared/components/FormInput';
import { surfaces } from '../../../shared/theme/surfaces';

const brazilianZones = {
  'America/Sao_Paulo': 'São Paulo',
  'America/Recife': 'Recife',
  'America/Fortaleza': 'Fortaleza',
  'America/Bahia': 'Salvador',
  'America/Belem': 'Belém',
  'America/Araguaina': 'Araguaína',
  'America/Maceio': 'Maceió',
  'America/Manaus': 'Manaus',
  'America/Boa_Vista': 'Boa Vista',
  'America/Porto_Velho': 'Porto Velho',
  'America/Cuiaba': 'Cuiabá',
  'America/Campo_Grande': 'Campo Grande',
  'America/Santarem': 'Santarém',
  'America/Rio_Branco': 'Rio Branco',
  'America/Eirunepe': 'Eirunepé',
  'America/Noronha': 'Fernando de Noronha',
};
const preferredZones = Object.keys(brazilianZones);
const allZones = [
  ...new Set([
    ...preferredZones,
    'UTC',
    ...(Intl.supportedValuesOf?.('timeZone') ?? []),
  ]),
];
const regionNames: Record<string, string> = {
  America: 'América',
  Asia: 'Ásia',
  Europe: 'Europa',
  Africa: 'África',
  Pacific: 'Pacífico',
  Atlantic: 'Atlântico',
  Australia: 'Austrália',
  Indian: 'Oceano Índico',
};

function labelFor(zone: string) {
  const brazilianCity = brazilianZones[zone as keyof typeof brazilianZones];
  if (brazilianCity) return `${brazilianCity}, Brasil`;
  const parts = zone.split('/');
  const city = (parts.at(-1) ?? zone).replaceAll('_', ' ');
  return parts.length > 1
    ? `${city}, ${regionNames[parts[0]] ?? parts[0]}`
    : city;
}

function searchKey(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function TimezonePicker({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (zone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const term = searchKey(query.trim());
  const options = term
    ? allZones.filter((zone) =>
        searchKey(`${labelFor(zone)} ${zone}`).includes(term),
      )
    : preferredZones;

  return (
    <View style={surfaces.field}>
      <Text style={surfaces.label}>Fuso horário</Text>
      <Text style={surfaces.text}>{labelFor(value)}</Text>
      <ActionButton
        label={
          open ? 'Fechar seleção de fuso horário' : 'Escolher fuso horário'
        }
        disabled={disabled}
        onPress={() => {
          setQuery('');
          setOpen(!open);
        }}
      />
      {open && (
        <>
          <FormField
            label="Buscar cidade ou região"
            placeholder="Ex.: Recife"
            value={query}
            onChangeText={setQuery}
            editable={!disabled}
          />
          {options.slice(0, 10).map((zone) => (
            <ActionButton
              key={zone}
              label={labelFor(zone)}
              primary={zone === value}
              disabled={disabled}
              onPress={() => {
                onChange(zone);
                setOpen(false);
              }}
            />
          ))}
          {options.length === 0 && (
            <Text accessibilityLiveRegion="polite" style={surfaces.text}>
              Nenhum fuso encontrado. Tente outra cidade ou região.
            </Text>
          )}
          {options.length > 10 && (
            <Text style={surfaces.text}>
              Digite mais para filtrar os resultados.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
