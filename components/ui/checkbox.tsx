import { TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '@/constants/colors';

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ checked = false, onCheckedChange, disabled = false }: CheckboxProps) {
  return (
    <TouchableOpacity
      onPress={() => !disabled && onCheckedChange?.(!checked)}
      disabled={disabled}
      className="relative flex items-center justify-center"
      activeOpacity={0.7}
    >
      <View 
        className={`h-5 w-5 rounded-sm ${
          checked ? 'bg-primary' : 'bg-white'
        }`}
        style={{ 
          borderWidth: 1.5,
          borderColor: checked ? colors.light.primary : colors.light.border,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? colors.light.primary : '#ffffff'
        }}
      >
        {checked && (
          <Check size={14} color="#ffffff" strokeWidth={3} />
        )}
      </View>
    </TouchableOpacity>
  );
}
