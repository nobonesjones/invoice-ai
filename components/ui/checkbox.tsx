import { TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';

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
    >
      <View 
        className={`h-5 w-5 rounded border border-input ${
          checked ? 'border-primary' : 'border-input'
        } bg-background`}
      >
        {checked && (
          <Check size={14} color="#8b5cf6" strokeWidth={3} />
        )}
      </View>
    </TouchableOpacity>
  );
}
