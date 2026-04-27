import { Link } from "react-router";

import { PageContainer } from "#/components/layout/page-container";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";

export default function NotFoundPage() {
  return (
    <PageContainer>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Page not found</h2>
          </CardTitle>
          <CardDescription>
            The route you requested does not exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/lobby">Return to lobby</Link>
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
