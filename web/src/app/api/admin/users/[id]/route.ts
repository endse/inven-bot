import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Prevent deleting yourself
    if (session.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
