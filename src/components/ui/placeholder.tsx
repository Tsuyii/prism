interface PlaceholderProps {
  title: string
  description: string
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <div className="mb-4 text-5xl">🌈</div>
        <h1 className="mb-2 text-2xl font-bold text-white">{title}</h1>
        <p className="text-gray-400">{description}</p>
      </div>
    </div>
  )
}
