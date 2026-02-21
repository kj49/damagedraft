import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';

import Button from './Button';
import { useThemeContext } from '../lib/theme';
import { CodeOption, ReportCodeRow } from '../types/models';

interface CodeEntryProps {
  codes: ReportCodeRow[];
  areaOptions: CodeOption[];
  typeOptions: CodeOption[];
  severityOptions: CodeOption[];
  topAreaCodes: string[];
  topTypeCodes: string[];
  onAddCode: (code: string) => Promise<void> | void;
  onRemoveCode: (codeId: string) => Promise<void> | void;
}

const HEADER_TOP_AREA = '__top_area_header';
const HEADER_ALL_AREA = '__all_area_header';
const HEADER_TOP_TYPE = '__top_type_header';
const HEADER_ALL_TYPE = '__all_type_header';
const HEADER_VALUES = new Set([
  HEADER_TOP_AREA,
  HEADER_ALL_AREA,
  HEADER_TOP_TYPE,
  HEADER_ALL_TYPE,
]);

export default function CodeEntry({
  codes,
  areaOptions,
  typeOptions,
  severityOptions,
  topAreaCodes,
  topTypeCodes,
  onAddCode,
  onRemoveCode,
}: CodeEntryProps) {
  const { theme } = useThemeContext();
  const [manualMode, setManualMode] = useState(false);
  const [errorText, setErrorText] = useState('');

  const sortedAreas = useMemo(
    () => [...areaOptions].sort((a, b) => a.code.localeCompare(b.code)),
    [areaOptions]
  );
  const sortedTypes = useMemo(
    () => [...typeOptions].sort((a, b) => a.code.localeCompare(b.code)),
    [typeOptions]
  );

  const [selectedArea, setSelectedArea] = useState(sortedAreas[0]?.code ?? '');
  const [selectedType, setSelectedType] = useState(sortedTypes[0]?.code ?? '');
  const [selectedSeverity, setSelectedSeverity] = useState(severityOptions[0]?.code ?? '1');

  const [manualArea, setManualArea] = useState('');
  const [manualType, setManualType] = useState('');
  const [manualSeverity, setManualSeverity] = useState('');

  const topAreaOptions = useMemo(() => {
    const byCode = new Map(sortedAreas.map((item) => [item.code, item]));
    return topAreaCodes.map((code) => byCode.get(code)).filter(Boolean) as CodeOption[];
  }, [sortedAreas, topAreaCodes]);

  const topTypeOptions = useMemo(() => {
    const byCode = new Map(sortedTypes.map((item) => [item.code, item]));
    return topTypeCodes.map((code) => byCode.get(code)).filter(Boolean) as CodeOption[];
  }, [sortedTypes, topTypeCodes]);

  const addCode = async () => {
    const area = manualMode ? manualArea.trim() : selectedArea;
    const type = manualMode ? manualType.trim() : selectedType;
    const severity = manualMode ? manualSeverity.trim() : selectedSeverity;

    if (!/^\d{2}$/.test(area) || !/^\d{2}$/.test(type) || !/^[1-6]$/.test(severity)) {
      setErrorText('Use valid digits: Area xx, Type xx, Severity 1-6.');
      return;
    }

    const formatted = `${area}-${type}-${severity}`;
    setErrorText('');
    await onAddCode(formatted);

    if (manualMode) {
      setManualArea('');
      setManualType('');
      setManualSeverity('');
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.modeRow}>
        <Text style={[styles.title, { color: theme.text }]}>Damage Codes</Text>
        <View style={styles.toggleWrap}>
          <Text style={{ color: theme.mutedText, fontSize: 13 }}>
            Entry mode: {manualMode ? 'Manual' : 'Dropdown'}
          </Text>
          <Switch value={manualMode} onValueChange={setManualMode} />
        </View>
      </View>

      {manualMode ? (
        <View style={styles.manualRow}>
          <TextInput
            placeholder="Area xx"
            value={manualArea}
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={setManualArea}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholderTextColor={theme.mutedText}
          />
          <TextInput
            placeholder="Type xx"
            value={manualType}
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={setManualType}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholderTextColor={theme.mutedText}
          />
          <TextInput
            placeholder="Severity x"
            value={manualSeverity}
            keyboardType="number-pad"
            maxLength={1}
            onChangeText={setManualSeverity}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholderTextColor={theme.mutedText}
          />
        </View>
      ) : (
        <View style={styles.dropdownWrap}>
          <Text style={[styles.selectedPreview, { color: theme.text }]}>
            Selected: {selectedArea || '--'} / {selectedType || '--'} / {selectedSeverity || '--'}
          </Text>
          <Text style={[styles.label, { color: theme.mutedText }]}>Area</Text>
          <View style={[styles.pickerWrap, { borderColor: theme.border, backgroundColor: '#fff' }]}>
            <Picker
              selectedValue={selectedArea}
              onValueChange={(value) => {
                const next = String(value);
                if (!HEADER_VALUES.has(next)) {
                  setSelectedArea(next);
                }
              }}
              style={[styles.picker, { color: theme.text }]}
              dropdownIconColor={theme.text}
            >
              {topAreaOptions.length > 0 && (
                <Picker.Item label="Top 5 Most Used" value={HEADER_TOP_AREA} enabled={false} />
              )}
              {topAreaOptions.map((item) => (
                <Picker.Item key={`top-area-${item.code}`} label={item.label} value={item.code} />
              ))}
              <Picker.Item label="All Areas" value={HEADER_ALL_AREA} enabled={false} />
              {sortedAreas.map((item) => (
                <Picker.Item key={`all-area-${item.code}`} label={item.label} value={item.code} />
              ))}
            </Picker>
          </View>

          <Text style={[styles.label, { color: theme.mutedText }]}>Type</Text>
          <View style={[styles.pickerWrap, { borderColor: theme.border, backgroundColor: '#fff' }]}>
            <Picker
              selectedValue={selectedType}
              onValueChange={(value) => {
                const next = String(value);
                if (!HEADER_VALUES.has(next)) {
                  setSelectedType(next);
                }
              }}
              style={[styles.picker, { color: theme.text }]}
              dropdownIconColor={theme.text}
            >
              {topTypeOptions.length > 0 && (
                <Picker.Item label="Top 5 Most Used" value={HEADER_TOP_TYPE} enabled={false} />
              )}
              {topTypeOptions.map((item) => (
                <Picker.Item key={`top-type-${item.code}`} label={item.label} value={item.code} />
              ))}
              <Picker.Item label="All Types" value={HEADER_ALL_TYPE} enabled={false} />
              {sortedTypes.map((item) => (
                <Picker.Item key={`all-type-${item.code}`} label={item.label} value={item.code} />
              ))}
            </Picker>
          </View>

          <Text style={[styles.label, { color: theme.mutedText }]}>Severity</Text>
          <View style={[styles.pickerWrap, { borderColor: theme.border, backgroundColor: '#fff' }]}>
            <Picker
              selectedValue={selectedSeverity}
              onValueChange={(value) => setSelectedSeverity(String(value))}
              style={[styles.picker, { color: theme.text }]}
              dropdownIconColor={theme.text}
            >
              {severityOptions.map((item) => (
                <Picker.Item key={item.code} label={item.label} value={item.code} />
              ))}
            </Picker>
          </View>
        </View>
      )}

      {errorText ? <Text style={[styles.error, { color: theme.danger }]}>{errorText}</Text> : null}

      <Button title="Submit Code" onPress={addCode} />

      <View style={styles.listWrap}>
        {codes.length === 0 ? (
          <Text style={{ color: theme.mutedText }}>No codes added.</Text>
        ) : (
          codes.map((item) => (
            <View key={item.id} style={[styles.codeRow, { borderColor: theme.border }]}> 
              <Text style={[styles.codeText, { color: theme.text }]}>{item.code}</Text>
              <Pressable onPress={() => onRemoveCode(item.id)} style={[styles.removeBtn, { backgroundColor: '#E2E8F0' }]}>
                <Text style={{ fontWeight: '700', color: theme.text }}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  toggleWrap: {
    alignItems: 'flex-end',
  },
  dropdownWrap: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 54,
  },
  selectedPreview: {
    fontSize: 13,
    fontWeight: '700',
  },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  listWrap: {
    gap: 8,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  codeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  removeBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
