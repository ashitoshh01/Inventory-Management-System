'use client';

import * as React from 'react';
import { Plus, Search, Tags, Edit2, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Textarea,
} from '@repo/ui';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../../hooks/use-categories';
import { usePermissions } from '../../hooks/use-permissions';
import type { CategoryDto } from '@repo/types';

export default function CategoriesPage() {
  const { canCreateCategory, canUpdateCategory, canDeleteCategory } = usePermissions();

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useCategories(debouncedSearch ? { search: debouncedSearch } : undefined);

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<CategoryDto | null>(null);
  const [categoryToDelete, setCategoryToDelete] = React.useState<CategoryDto | null>(null);

  // Form states
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const categories = response?.data || [];

  const handleOpenCreate = () => {
    setName('');
    setDescription('');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (category: CategoryDto) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    try {
      setFormError(null);
      if (editingCategory) {
        await updateMutation.mutateAsync({
          id: editingCategory.id,
          data: { name: name.trim(), description: description.trim() || null },
        });
        setEditingCategory(null);
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
        });
        setIsCreateOpen(false);
      }
      setName('');
      setDescription('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save category';
      setFormError(msg);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteMutation.mutateAsync(categoryToDelete.id);
      setCategoryToDelete(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">
            Organize, classify, and structure catalog products across your organization.
          </p>
        </div>
        {canCreateCategory && (
          <Button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Category
          </Button>
        )}
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">
                All Categories ({categories.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Manage your product classification hierarchy
              </CardDescription>
            </div>
            {/* Search Input */}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">Failed to load categories</p>
                <p className="text-xs text-slate-500">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={Tags}
                title={debouncedSearch ? 'No categories found' : 'No categories yet'}
                description={
                  debouncedSearch
                    ? `No categories matching "${debouncedSearch}". Try another search term.`
                    : 'Get started by creating your first product category.'
                }
                action={
                  canCreateCategory && !debouncedSearch ? (
                    <Button onClick={handleOpenCreate} size="sm" className="mt-2">
                      <Plus className="mr-1.5 h-4 w-4" />
                      Create Category
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                    <TableHead className="font-semibold text-slate-700">Name</TableHead>
                    <TableHead className="font-semibold text-slate-700">Description</TableHead>
                    <TableHead className="font-semibold text-slate-700">Created</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Tags className="h-4 w-4 text-blue-500" />
                          <span>{cat.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-slate-600">
                        {cat.description || (
                          <span className="italic text-slate-400">No description</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(cat.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canUpdateCategory && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(cat)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                              aria-label={`Edit ${cat.name}`}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDeleteCategory && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCategoryToDelete(cat)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-red-600"
                              aria-label={`Delete ${cat.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingCategory}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingCategory(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Update category details below.'
                  : 'Add a new category to classify products.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="category-name">Name *</Label>
                <Input
                  id="category-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Raw Materials, Electronics"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-desc">Description</Label>
                <Textarea
                  id="category-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this category..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingCategory(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!categoryToDelete}
        onOpenChange={(open) => {
          if (!open) setCategoryToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete category{' '}
              <span className="font-semibold text-slate-800">
                &ldquo;{categoryToDelete?.name}&rdquo;
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCategoryToDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
