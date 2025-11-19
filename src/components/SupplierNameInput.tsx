interface SupplierNameInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SupplierNameInput({ value, onChange }: SupplierNameInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Supplier name..."
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
    />
  );
}
