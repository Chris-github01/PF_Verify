interface PageHeaderProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      {children}
    </div>
  );
}
