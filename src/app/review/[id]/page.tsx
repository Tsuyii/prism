import { Placeholder } from '@/components/ui/placeholder'

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Placeholder
      title="Review Post"
      description="Review and approve your post — coming in Plan 3."
    />
  )
}
